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
