import { describe, expect, it } from "vitest";
import { buildSyncLogEntry } from "../worker/changelog";
import type { DayData, ForecastPayload } from "../shared/types";

const flat = (value: number): number[] => new Array(24).fill(value);

function day(overrides: Partial<DayData> = {}): DayData {
  return {
    date: "2026-08-30",
    temps: flat(80),
    precipProb: flat(5),
    source: "forecast",
    contributingSources: ["Open-Meteo"],
    ...overrides,
  };
}

function payload(fetchedAt: string, days: DayData[]): ForecastPayload {
  return { fetchedAt, days };
}

describe("buildSyncLogEntry", () => {
  it("records cache initialization", () => {
    const entry = buildSyncLogEntry(null, payload("2026-07-15T00:00:00Z", [day()]), "manual");

    expect(entry.changed).toBe(true);
    expect(entry.summary).toContain("initialized");
    expect(entry.changes[0]?.details).toEqual(["initialized 1 event days"]);
  });

  it("records no-op syncs", () => {
    const previous = payload("2026-07-15T00:00:00Z", [day()]);
    const next = payload("2026-07-15T01:00:00Z", [day()]);
    const entry = buildSyncLogEntry(previous, next, "scheduled");

    expect(entry.changed).toBe(false);
    expect(entry.summary).toContain("No forecast values changed");
    expect(entry.changes).toEqual([]);
  });

  it("summarizes day-level weather changes", () => {
    const previous = payload("2026-07-15T00:00:00Z", [day()]);
    const next = payload("2026-07-15T01:00:00Z", [
      day({
        temps: flat(84),
        precipProb: flat(12),
        contributingSources: ["Open-Meteo", "NWS"],
      }),
    ]);
    const entry = buildSyncLogEntry(previous, next, "manual");

    expect(entry.changed).toBe(true);
    expect(entry.summary).toBe("1 day updated by manual sync.");
    expect(entry.changes[0]?.label).toBe("Sunday, August 30");
    expect(entry.changes[0]?.details).toEqual([
      "sources Open-Meteo -> Open-Meteo / NWS",
      "high 80F -> 84F",
      "low 80F -> 84F",
      "peak rain 5% -> 12%",
    ]);
  });
});

describe("buildSyncLogEntry alerts", () => {
  const day = {
    date: "2026-08-30",
    temps: new Array(24).fill(90),
    precipProb: new Array(24).fill(0),
    source: "forecast" as const,
  };
  const alert = {
    id: "urn:oid:test.1",
    event: "Dust Storm Warning",
    severity: "Severe",
    headline: "Dust Storm Warning until 8PM PDT",
  };

  it("pins a newly issued alert to the top of the change list", () => {
    const entry = buildSyncLogEntry(
      { fetchedAt: "2026-08-29T14:00:00Z", days: [day] },
      { fetchedAt: "2026-08-29T20:00:00Z", days: [day], alerts: [alert] },
      "scheduled",
    );
    expect(entry.changed).toBe(true);
    expect(entry.changes[0]?.label).toBe("NWS alerts");
    expect(entry.changes[0]?.details).toEqual(["ISSUED Dust Storm Warning (Severe)"]);
    expect(entry.summary).toContain("ISSUED Dust Storm Warning");
  });

  it("reports an alert clearing", () => {
    const entry = buildSyncLogEntry(
      { fetchedAt: "2026-08-29T14:00:00Z", days: [day], alerts: [alert] },
      { fetchedAt: "2026-08-29T20:00:00Z", days: [day] },
      "scheduled",
    );
    expect(entry.changes[0]?.details).toEqual(["cleared Dust Storm Warning"]);
  });

  it("says nothing changed when alerts and days are both stable", () => {
    const entry = buildSyncLogEntry(
      { fetchedAt: "2026-08-29T14:00:00Z", days: [day], alerts: [alert] },
      { fetchedAt: "2026-08-29T20:00:00Z", days: [day], alerts: [alert] },
      "scheduled",
    );
    expect(entry.changed).toBe(false);
    expect(entry.summary).toContain("No forecast values changed");
  });

  it("reports a wind change on a day", () => {
    const entry = buildSyncLogEntry(
      { fetchedAt: "2026-08-29T14:00:00Z", days: [{ ...day, wind: new Array(24).fill(10) }] },
      { fetchedAt: "2026-08-29T20:00:00Z", days: [{ ...day, wind: new Array(24).fill(28) }] },
      "scheduled",
    );
    expect(entry.changes[0]?.details).toContain("peak wind 10 -> 28 mph");
  });
});

