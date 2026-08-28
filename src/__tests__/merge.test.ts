import { describe, expect, it } from "vitest";
import { computeDivergences, median, mergeDays } from "../worker/merge";
import type { NormalizedSource, EnsembleMembers } from "../worker/sources";
import type { DayProfile } from "../shared/types";
import { scaleFor } from "../components/HourlyCurve";

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

function source(
  name: string,
  temp: number,
  precip: number,
  wind?: number,
  gust?: number,
): NormalizedSource {
  return {
    name,
    temps: { "2026-08-30": flat(temp) },
    precip: { "2026-08-30": flat(precip) },
    wind: wind === undefined ? {} : { "2026-08-30": flat(wind) },
    gusts: gust === undefined ? {} : { "2026-08-30": flat(gust) },
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

describe("mergeDays wind", () => {
  it("takes the per-hour median wind across sources that report it", () => {
    const [day] = mergeDays(
      [PROFILE],
      [source("a", 90, 0, 10), source("b", 90, 0, 20), source("c", 90, 0, 30)],
    );
    expect(day?.wind?.[0]).toBe(20);
  });

  it("merges wind from sources that have it even when another source does not", () => {
    // NWS carries no gusts at this gridpoint; it must still contribute temps.
    const [day] = mergeDays(
      [PROFILE],
      [source("nws", 90, 0, 12), source("gfs", 90, 0, 18, 30)],
    );
    expect(day?.wind?.[0]).toBe(15);
    expect(day?.gusts?.[0]).toBe(30);
    expect(day?.contributingSources).toEqual(["nws", "gfs"]);
  });

  it("omits wind entirely when no source reports it", () => {
    const [day] = mergeDays([PROFILE], [source("a", 90, 0)]);
    expect(day?.wind).toBeUndefined();
    expect(day?.gusts).toBeUndefined();
  });

  it("still merges temps when a source has wind but fails temp validation", () => {
    const broken: NormalizedSource = {
      name: "broken",
      temps: { "2026-08-30": new Array(24).fill(null) },
      precip: { "2026-08-30": flat(0) },
      wind: { "2026-08-30": flat(40) },
      gusts: {},
    };
    const [day] = mergeDays([PROFILE], [source("good", 90, 0, 10), broken]);
    expect(day?.temps[0]).toBe(90);
    // The broken source's wind is still usable — validation is per-metric.
    expect(day?.wind?.[0]).toBe(25);
  });

  it("falls back to climatology (no wind) when no source covers the date", () => {
    const [day] = mergeDays([PROFILE], []);
    expect(day?.source).toBe("climatology");
    expect(day?.wind).toBeUndefined();
  });
});


describe("scaleFor wind axis", () => {
  const gridsFor = (peak: number): number[] =>
    scaleFor("wind", new Array(24).fill(peak), undefined).gridVals;

  it("keeps a floor of 30 mph so a calm day isn't all noise", () => {
    const scale = scaleFor("wind", new Array(24).fill(4), undefined);
    expect(scale.max).toBe(30);
    expect(scale.gridVals).toEqual([10, 20, 30]);
  });

  it("labels gridlines in round 10s, never max/4 fractions", () => {
    expect(gridsFor(34)).toEqual([10, 20, 30, 40]);
    expect(gridsFor(41)).toEqual([10, 20, 30, 40, 50]);
  });

  it("steps in 20s once 10s would crowd the axis", () => {
    expect(gridsFor(55)).toEqual([20, 40, 60]);
  });

  it("includes gusts when sizing the axis", () => {
    const scale = scaleFor("wind", new Array(24).fill(10), {
      min: new Array(24).fill(10),
      max: new Array(24).fill(44),
    });
    expect(scale.max).toBe(50);
  });

  it("leaves the temp and precip scales untouched", () => {
    expect(scaleFor("temp", new Array(24).fill(80), undefined)).toEqual({
      min: 40,
      max: 100,
      gridVals: [50, 70, 90],
    });
    expect(scaleFor("precip", new Array(24).fill(5), undefined).max).toBe(30);
    expect(scaleFor("precip", new Array(24).fill(60), undefined).max).toBe(100);
  });
});
