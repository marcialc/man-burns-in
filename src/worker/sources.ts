import { DAY_PROFILES } from "../data/climatology";

// Black Rock City (The Man), 2026 event window.
export const LATITUDE = 40.786;
export const LONGITUDE = -119.204;
export const START_DATE = "2026-08-30";
export const END_DATE = "2026-09-07";

/** ISO dates (America/Los_Angeles) we care about, in order. */
export const EVENT_DATES: readonly string[] = DAY_PROFILES.map((d) => d.date);
const EVENT_DATE_SET = new Set(EVENT_DATES);

/** A source's hourly values, keyed by ISO date → 24 slots (index = local hour). */
export type ByDate = Record<string, (number | null)[]>;

/** One weather source, normalized to America/Los_Angeles hourly buckets. */
export interface NormalizedSource {
  name: string;
  temps: ByDate;
  precip: ByDate;
}

/** Ensemble temperature members, keyed by ISO date → list of 24-length member series. */
export interface EnsembleMembers {
  tempsByDate: Record<string, number[][]>;
}

/** A fresh 24-slot array pre-filled with null. */
function emptyDay(): (number | null)[] {
  return new Array<number | null>(24).fill(null);
}

/**
 * Bucket a flat hourly series into per-date 24-slot arrays, keeping only our
 * event dates. `times` are local-ish ISO strings ("2026-08-30T14:00" or with an
 * offset like "...T14:00:00-07:00"); the date and hour are read from the literal.
 */
function bucketByDate(times: string[], values: (number | null)[]): ByDate {
  const out: ByDate = {};
  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    if (!time) continue;
    const date = time.slice(0, 10);
    if (!EVENT_DATE_SET.has(date)) continue;
    const hour = Number.parseInt(time.slice(11, 13), 10);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) continue;
    (out[date] ??= emptyDay())[hour] = values[i] ?? null;
  }
  return out;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation_probability: (number | null)[];
}

/** Open-Meteo deterministic forecast (free, no key). */
export async function fetchOpenMeteoForecast(): Promise<NormalizedSource | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      `&hourly=temperature_2m,precipitation_probability&temperature_unit=fahrenheit` +
      `&timezone=America/Los_Angeles&start_date=${START_DATE}&end_date=${END_DATE}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: OpenMeteoHourly };
    const hourly = data.hourly;
    if (!hourly?.time) return null;
    return {
      name: "open-meteo",
      temps: bucketByDate(hourly.time, hourly.temperature_2m ?? []),
      precip: bucketByDate(hourly.time, hourly.precipitation_probability ?? []),
    };
  } catch {
    return null;
  }
}

/**
 * Open-Meteo ensemble (~30 members across GFS + ECMWF). Used only for the
 * per-hour temperature spread that feeds the uncertainty band.
 */
export async function fetchOpenMeteoEnsemble(): Promise<EnsembleMembers | null> {
  try {
    const url =
      `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      `&hourly=temperature_2m&temperature_unit=fahrenheit&models=gfs_seamless,ecmwf_ifs025` +
      `&timezone=America/Los_Angeles&start_date=${START_DATE}&end_date=${END_DATE}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: Record<string, unknown> & { time?: string[] };
    };
    const hourly = data.hourly;
    if (!hourly?.time) return null;
    const times = hourly.time;

    // Every "temperature_2m*" key is one ensemble member series.
    const tempsByDate: Record<string, number[][]> = {};
    for (const [key, value] of Object.entries(hourly)) {
      if (!key.startsWith("temperature_2m") || !Array.isArray(value)) continue;
      const member = bucketByDate(times, value as (number | null)[]);
      for (const date of EVENT_DATES) {
        const series = member[date];
        if (!series) continue;
        // Keep only complete member coverage for this date.
        if (series.some((v) => v === null || v === undefined || Number.isNaN(v))) continue;
        (tempsByDate[date] ??= []).push(series as number[]);
      }
    }
    return { tempsByDate };
  } catch {
    return null;
  }
}

interface NwsPeriod {
  startTime: string;
  temperature: number | null;
  probabilityOfPrecipitation?: { value: number | null } | null;
}

/** US National Weather Service hourly forecast (free, no key; requires User-Agent). */
export async function fetchNWS(): Promise<NormalizedSource | null> {
  const headers = {
    "User-Agent": "man-burns-in (weather app; contact: hello@man-burns-in.example)",
    Accept: "application/geo+json",
  };
  try {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${LATITUDE},${LONGITUDE}`,
      { headers },
    );
    if (!pointsRes.ok) return null;
    const points = (await pointsRes.json()) as {
      properties?: { forecastHourly?: string };
    };
    const hourlyUrl = points.properties?.forecastHourly;
    if (!hourlyUrl) return null;

    const forecastRes = await fetch(hourlyUrl, { headers });
    if (!forecastRes.ok) return null;
    const forecast = (await forecastRes.json()) as {
      properties?: { periods?: NwsPeriod[] };
    };
    const periods = forecast.properties?.periods;
    if (!periods?.length) return null;

    const times = periods.map((p) => p.startTime);
    const temps = periods.map((p) => (typeof p.temperature === "number" ? p.temperature : null));
    const precip = periods.map((p) => {
      const v = p.probabilityOfPrecipitation?.value;
      return typeof v === "number" ? v : null;
    });

    return {
      name: "nws",
      temps: bucketByDate(times, temps),
      precip: bucketByDate(times, precip),
    };
  } catch {
    return null;
  }
}
