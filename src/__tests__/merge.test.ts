import { describe, expect, it } from "vitest";
import { computeDivergences, median, mergeDays } from "../worker/merge";
import type { NormalizedSource, EnsembleMembers } from "../worker/sources";
import type { DayProfile } from "../shared/types";

const PROFILE: DayProfile = {
  date: "2026-08-30",
  dow: "Sun",
  label: "Sunday, August 30",
  note: "Gates open",
  hi: 95,
  lo: 54,
  popPeak: 5,
};

const flat = (v: number): number[] => new Array(24).fill(v);

function source(name: string, temp: number, precip: number): NormalizedSource {
  return {
    name,
    temps: { "2026-08-30": flat(temp) },
    precip: { "2026-08-30": flat(precip) },
  };
}

describe("median", () => {
  it("returns the middle of an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middle values of an even-length list", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("handles a single element", () => {
    expect(median([42])).toBe(42);
  });
  it("throws on empty input", () => {
    expect(() => median([])).toThrow();
  });
});

describe("mergeDays", () => {
  it("takes the per-hour median across sources", () => {
    const sources = [source("a", 70, 10), source("b", 80, 20), source("c", 90, 30)];
    const [day] = mergeDays([PROFILE], sources);
    expect(day?.source).toBe("forecast");
    expect(day?.temps[0]).toBe(80); // median of 70,80,90
    expect(day?.precipProb[0]).toBe(20); // median of 10,20,30
    expect(day?.contributingSources).toEqual(["a", "b", "c"]);
  });

  it("averages two-source medians and rounds", () => {
    const sources = [source("a", 70, 10), source("b", 75, 15)];
    const [day] = mergeDays([PROFILE], sources);
    expect(day?.temps[0]).toBe(73); // round(72.5)
    expect(day?.precipProb[0]).toBe(13); // round(12.5)
  });

  it("falls back to climatology when no source covers the date", () => {
    const [day] = mergeDays([PROFILE], []);
    expect(day?.source).toBe("climatology");
    expect(day?.contributingSources).toBeUndefined();
    expect(day?.temps).toHaveLength(24);
  });

  it("rejects an invalid source but keeps a valid one", () => {
    const bad: NormalizedSource = {
      name: "bad",
      temps: { "2026-08-30": [...flat(70).slice(0, 23), null] as number[] },
      precip: { "2026-08-30": flat(10) },
    };
    const good = source("good", 80, 20);
    const [day] = mergeDays([PROFILE], [bad, good]);
    expect(day?.source).toBe("forecast");
    expect(day?.contributingSources).toEqual(["good"]);
    expect(day?.temps[0]).toBe(80);
  });

  it("builds a band from ensemble members + sources", () => {
    const sources = [source("a", 75, 10), source("b", 85, 10)];
    const ensemble: EnsembleMembers = {
      tempsByDate: { "2026-08-30": [flat(70), flat(90)] },
    };
    const [day] = mergeDays([PROFILE], sources, ensemble);
    expect(day?.band?.tempMin[0]).toBe(70);
    expect(day?.band?.tempMax[0]).toBe(90);
  });

  it("omits the band when only one series is available", () => {
    const [day] = mergeDays([PROFILE], [source("a", 75, 10)]);
    expect(day?.band).toBeUndefined();
  });
});

describe("computeDivergences", () => {
  it("flags temp spread > 8°F", () => {
    const sources = [source("a", 70, 10), source("b", 80, 10)];
    const divs = computeDivergences([PROFILE], sources);
    expect(divs.some((d) => d.kind === "temp" && d.spread === 10)).toBe(true);
  });

  it("flags precip spread > 20%", () => {
    const sources = [source("a", 75, 5), source("b", 75, 30)];
    const divs = computeDivergences([PROFILE], sources);
    expect(divs.some((d) => d.kind === "precip" && d.spread === 25)).toBe(true);
  });

  it("does not flag a spread at or below threshold", () => {
    const sources = [source("a", 75, 10), source("b", 83, 10)]; // temp spread exactly 8
    const divs = computeDivergences([PROFILE], sources);
    expect(divs.some((d) => d.kind === "temp")).toBe(false);
  });

  it("needs at least two valid sources", () => {
    expect(computeDivergences([PROFILE], [source("a", 70, 10)])).toEqual([]);
  });
});
