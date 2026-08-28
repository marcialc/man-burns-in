// Source validation. A source is rejected per-date (never the whole run) when
// its coverage for that date fails any check.

const TEMP_MIN = -20;
const TEMP_MAX = 130;
const PRECIP_MIN = 0;
const PRECIP_MAX = 100;
const WIND_MIN = 0;
const WIND_MAX = 150;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 24 non-null temperatures, each within −20…130 °F. */
export function isValidTempSeries(vals: readonly (number | null)[] | undefined): vals is number[] {
  if (!vals || vals.length !== 24) return false;
  return vals.every((v) => isFiniteNumber(v) && v >= TEMP_MIN && v <= TEMP_MAX);
}

/** 24 non-null probabilities, each within 0…100 %. */
export function isValidPrecipSeries(vals: readonly (number | null)[] | undefined): vals is number[] {
  if (!vals || vals.length !== 24) return false;
  return vals.every((v) => isFiniteNumber(v) && v >= PRECIP_MIN && v <= PRECIP_MAX);
}

/**
 * 24 non-null wind speeds, each within 0…150 mph. Wind is validated separately
 * from temp/precip and never gates a source's date coverage: NWS carries no
 * gusts at this gridpoint, and losing its temperature for that would be silly.
 */
export function isValidWindSeries(vals: readonly (number | null)[] | undefined): vals is number[] {
  if (!vals || vals.length !== 24) return false;
  return vals.every((v) => isFiniteNumber(v) && v >= WIND_MIN && v <= WIND_MAX);
}

/** A source covers a date only if BOTH its temp and precip series are valid. */
export function isValidSourceDate(
  temps: readonly (number | null)[] | undefined,
  precip: readonly (number | null)[] | undefined,
): boolean {
  return isValidTempSeries(temps) && isValidPrecipSeries(precip);
}
