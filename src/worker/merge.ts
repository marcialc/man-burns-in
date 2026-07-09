import { climatologyDay } from "../data/climatology";
import type { DayData, DayProfile } from "../shared/types";
import type { EnsembleMembers, NormalizedSource } from "./sources";
import { isValidPrecipSeries, isValidTempSeries } from "./validate";

/** Median of a non-empty numeric list. */
export function median(nums: readonly number[]): number {
  if (nums.length === 0) throw new Error("median of empty list");
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** A source that has passed validation for a specific date. */
interface ValidSourceForDate {
  name: string;
  temps: number[];
  precip: number[];
}

/**
 * Merge validated sources (plus ensemble spread) into per-day resolved data.
 * Pure and deterministic: given the same inputs it always returns the same output.
 *
 * - Per hour, per metric: median across the sources that cover the date.
 * - Per hour temperature min/max across sources + ensemble members → band.
 * - A date with ≥1 valid source → source:"forecast"; otherwise climatology fallback.
 */
export function mergeDays(
  profiles: readonly DayProfile[],
  sources: readonly NormalizedSource[],
  ensemble?: EnsembleMembers | null,
): DayData[] {
  return profiles.map((profile) => {
    const date = profile.date;

    const valid: ValidSourceForDate[] = [];
    for (const s of sources) {
      const temps = s.temps[date];
      const precip = s.precip[date];
      if (isValidTempSeries(temps) && isValidPrecipSeries(precip)) {
        valid.push({ name: s.name, temps, precip });
      }
    }

    if (valid.length === 0) {
      return climatologyDay(profile);
    }

    const temps: number[] = [];
    const precipProb: number[] = [];
    for (let h = 0; h < 24; h++) {
      temps.push(Math.round(median(valid.map((s) => s.temps[h] as number))));
      precipProb.push(Math.round(median(valid.map((s) => s.precip[h] as number))));
    }

    const day: DayData = {
      date,
      temps,
      precipProb,
      source: "forecast",
      contributingSources: valid.map((s) => s.name),
    };

    const band = computeBand(date, valid, ensemble);
    if (band) day.band = band;

    return day;
  });
}

function computeBand(
  date: string,
  valid: readonly ValidSourceForDate[],
  ensemble?: EnsembleMembers | null,
): DayData["band"] | undefined {
  const pool: number[][] = valid.map((s) => s.temps);
  const members = ensemble?.tempsByDate[date];
  if (members) pool.push(...members);

  // A band is only meaningful with more than one series to spread across.
  if (pool.length < 2) return undefined;

  const tempMin: number[] = [];
  const tempMax: number[] = [];
  for (let h = 0; h < 24; h++) {
    const col = pool.map((series) => series[h] as number);
    tempMin.push(Math.round(Math.min(...col)));
    tempMax.push(Math.round(Math.max(...col)));
  }
  return { tempMin, tempMax };
}

/** One hour where sources disagree materially (for the AI outlook prompt). */
export interface Divergence {
  date: string;
  hour: number;
  kind: "temp" | "precip";
  spread: number;
}

/** Hours where sources diverge by >8 °F or >20 % precip (needs ≥2 valid sources). */
export function computeDivergences(
  profiles: readonly DayProfile[],
  sources: readonly NormalizedSource[],
): Divergence[] {
  const out: Divergence[] = [];
  for (const profile of profiles) {
    const date = profile.date;
    const valid = sources.filter(
      (s) => isValidTempSeries(s.temps[date]) && isValidPrecipSeries(s.precip[date]),
    );
    if (valid.length < 2) continue;

    for (let h = 0; h < 24; h++) {
      const temps = valid.map((s) => (s.temps[date] as number[])[h] as number);
      const precips = valid.map((s) => (s.precip[date] as number[])[h] as number);
      const tempSpread = Math.max(...temps) - Math.min(...temps);
      const precipSpread = Math.max(...precips) - Math.min(...precips);
      if (tempSpread > 8) out.push({ date, hour: h, kind: "temp", spread: tempSpread });
      if (precipSpread > 20) out.push({ date, hour: h, kind: "precip", spread: precipSpread });
    }
  }
  return out;
}
