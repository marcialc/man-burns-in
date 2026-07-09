import { describe, expect, it } from "vitest";
import { isStale, isWithinDailyWindow } from "../worker/stale";

describe("isStale", () => {
  const now = new Date("2026-08-20T14:00:00Z");

  it("is stale when fetchedAt is missing or unparseable", () => {
    expect(isStale(undefined, now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
    expect(isStale("not-a-date", now)).toBe(true);
  });

  it("is fresh within 8 days", () => {
    expect(isStale("2026-08-19T14:00:00Z", now)).toBe(false); // 1 day
    expect(isStale("2026-08-13T14:00:00Z", now)).toBe(false); // 7 days
  });

  it("is fresh at exactly 8 days", () => {
    expect(isStale("2026-08-12T14:00:00Z", now)).toBe(false);
  });

  it("is stale just past 8 days", () => {
    expect(isStale("2026-08-12T13:59:59Z", now)).toBe(true);
  });
});

describe("isWithinDailyWindow", () => {
  // Anchor: Aug 30 2026 00:01 PDT === Aug 30 2026 07:01 UTC.
  it("is active within 10 days before the anchor", () => {
    expect(isWithinDailyWindow(new Date("2026-08-25T07:01:00Z"))).toBe(true);
    expect(isWithinDailyWindow(new Date("2026-08-20T07:01:00Z"))).toBe(true); // exactly 10 days
  });

  it("is active within 10 days after the anchor", () => {
    expect(isWithinDailyWindow(new Date("2026-09-05T07:01:00Z"))).toBe(true);
  });

  it("no-ops well before the window", () => {
    expect(isWithinDailyWindow(new Date("2026-07-01T07:01:00Z"))).toBe(false);
  });

  it("no-ops just outside 10 days before", () => {
    expect(isWithinDailyWindow(new Date("2026-08-20T06:00:00Z"))).toBe(false);
  });
});
