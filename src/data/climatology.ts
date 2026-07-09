import type { DayData, DayProfile } from "../shared/types";

// Expected day profiles from Black Rock Desert climatology (late Aug / early Sep).
// hi/lo °F · popPeak = peak hourly precip probability %.
// Adapted from this project's original single-file prototype, with ISO dates added.
export const DAY_PROFILES: readonly DayProfile[] = [
  { date: "2026-08-30", dow: "Sun", label: "Sunday, August 30", note: "Arrival day", hi: 95, lo: 54, popPeak: 5 },
  { date: "2026-08-31", dow: "Mon", label: "Monday, August 31", note: "City fills in", hi: 96, lo: 56, popPeak: 5 },
  { date: "2026-09-01", dow: "Tue", label: "Tuesday, September 1", note: "Peak-heat risk day", hi: 97, lo: 57, popPeak: 10 },
  { date: "2026-09-02", dow: "Wed", label: "Wednesday, September 2", note: "Midweek · t-storm watch window", hi: 94, lo: 55, popPeak: 15 },
  { date: "2026-09-03", dow: "Thu", label: "Thursday, September 3", note: "Cooling trend often begins", hi: 92, lo: 52, popPeak: 10 },
  { date: "2026-09-04", dow: "Fri", label: "Friday, September 4", note: "Big art nights", hi: 90, lo: 50, popPeak: 5 },
  { date: "2026-09-05", dow: "Sat", label: "Saturday, September 5", note: "The Man burns", hi: 89, lo: 49, popPeak: 5 },
  { date: "2026-09-06", dow: "Sun", label: "Sunday, September 6", note: "Temple burn", hi: 88, lo: 47, popPeak: 5 },
  { date: "2026-09-07", dow: "Mon", label: "Monday, September 7", note: "Exodus — coolest morning", hi: 87, lo: 45, popPeak: 5 },
] as const;

/**
 * Diurnal temperature model: minimum ~5 AM, maximum ~4 PM.
 * Returns 24 rounded hourly temperatures (°F).
 */
export function hourlyTemps(hi: number, lo: number): number[] {
  const temps: number[] = [];
  for (let h = 0; h < 24; h++) {
    let f: number;
    if (h >= 5 && h <= 16) {
      f = Math.sin(((h - 5) / 11) * (Math.PI / 2));
      f = Math.pow(f, 0.9);
    } else {
      const t = h > 16 ? h - 16 : h + 8;
      f = Math.cos((t / 13) * (Math.PI / 2));
      f = Math.pow(f, 0.75);
    }
    temps.push(Math.round(lo + f * (hi - lo)));
  }
  return temps;
}

/**
 * Precip probability model: desert convective pattern — near-zero overnight and
 * morning, a small bump 1–7 PM peaking mid-afternoon.
 */
export function hourlyPrecip(popPeak: number): number[] {
  const pop: number[] = [];
  for (let h = 0; h < 24; h++) {
    let p: number;
    if (h >= 12 && h <= 19) {
      const f = Math.sin(((h - 12) / 7) * Math.PI); // 0 at noon & 7pm, peak mid-afternoon
      p = Math.round(popPeak * f);
    } else if (h >= 20 && h <= 22) {
      p = Math.max(0, Math.round(popPeak * 0.2)); // lingering evening cells
    } else {
      p = 0;
    }
    pop.push(p);
  }
  return pop;
}

/** Build a single climatology-sourced DayData from a profile. */
export function climatologyDay(profile: DayProfile): DayData {
  return {
    date: profile.date,
    temps: hourlyTemps(profile.hi, profile.lo),
    precipProb: hourlyPrecip(profile.popPeak),
    source: "climatology",
  };
}

/** The full 9-day climatology fallback, used by both client and worker. */
export function climatologyDays(): DayData[] {
  return DAY_PROFILES.map(climatologyDay);
}
