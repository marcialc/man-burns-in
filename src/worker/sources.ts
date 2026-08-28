import { DAY_PROFILES } from "../data/climatology";
import type { WeatherAlert } from "../shared/types";

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
  /** Sustained wind (mph). Empty when the source doesn't report it. */
  wind: ByDate;
  /** Wind gusts (mph). Empty when the source doesn't report them (e.g. NWS hourly). */
  gusts: ByDate;
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
  wind_speed_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
}

/**
 * One deterministic Open-Meteo model, normalized. We name the models explicitly
 * rather than using `best_match` so the per-hour median is a real vote between
 * independent models (ECMWF vs GFS vs NWS) instead of a blend voting against a
 * blend. Both models below cover the full event window; ICON/GEM/Météo-France
 * run out of range partway through it, which is why they aren't used.
 */
export async function fetchOpenMeteoModel(
  model: string,
  name: string,
): Promise<NormalizedSource | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
      `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&models=${model}` +
      `&timezone=America/Los_Angeles&start_date=${START_DATE}&end_date=${END_DATE}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: OpenMeteoHourly };
    const hourly = data.hourly;
    if (!hourly?.time) return null;
    return {
      name,
      temps: bucketByDate(hourly.time, hourly.temperature_2m ?? []),
      precip: bucketByDate(hourly.time, hourly.precipitation_probability ?? []),
      wind: bucketByDate(hourly.time, hourly.wind_speed_10m ?? []),
      gusts: bucketByDate(hourly.time, hourly.wind_gusts_10m ?? []),
    };
  } catch {
    return null;
  }
}

/** ECMWF IFS 0.25° — the strongest global model at day 5–9, our pre-event window. */
export function fetchEcmwf(): Promise<NormalizedSource | null> {
  return fetchOpenMeteoModel("ecmwf_ifs025", "ecmwf");
}

/** NOAA GFS (seamless: HRRR → GFS as lead time grows). */
export function fetchGfs(): Promise<NormalizedSource | null> {
  return fetchOpenMeteoModel("gfs_seamless", "gfs");
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

const NWS_HEADERS = {
  "User-Agent": "man-burns-in (weather app; contact: https://github.com/marcialc/man-burns-in/issues)",
  Accept: "application/geo+json",
};

interface NwsPeriod {
  startTime: string;
  temperature: number | null;
  probabilityOfPrecipitation?: { value: number | null } | null;
  windSpeed?: string | null;
}

/**
 * NWS reports wind as a display string: "15 mph" or a range, "5 to 10 mph".
 * We take the upper bound — that's the headline value the forecast is built
 * around, and the conservative read for a hazard metric.
 */
export function parseNwsWind(value: string | null | undefined): number | null {
  if (!value) return null;
  const numbers = value.match(/\d+/g);
  if (!numbers?.length) return null;
  const upper = Number.parseInt(numbers[numbers.length - 1] as string, 10);
  return Number.isFinite(upper) ? upper : null;
}

/**
 * US National Weather Service hourly forecast (free, no key; requires User-Agent).
 * The points lookup resolves these coordinates to gridpoint REV/76,159 — the
 * Reno office burningman.org points at, but at the playa itself rather than
 * Gerlach 18 km away. The hourly product carries no windGust, so NWS
 * contributes sustained wind only.
 */
export async function fetchNWS(): Promise<NormalizedSource | null> {
  try {
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${LATITUDE},${LONGITUDE}`,
      { headers: NWS_HEADERS },
    );
    if (!pointsRes.ok) return null;
    const points = (await pointsRes.json()) as {
      properties?: { forecastHourly?: string };
    };
    const hourlyUrl = points.properties?.forecastHourly;
    if (!hourlyUrl) return null;

    const forecastRes = await fetch(hourlyUrl, { headers: NWS_HEADERS });
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
    const wind = periods.map((p) => parseNwsWind(p.windSpeed));

    return {
      name: "nws",
      temps: bucketByDate(times, temps),
      precip: bucketByDate(times, precip),
      wind: bucketByDate(times, wind),
      gusts: {},
    };
  } catch {
    return null;
  }
}

interface NwsAlertFeature {
  properties?: {
    id?: string;
    event?: string;
    severity?: string;
    headline?: string;
    onset?: string;
    ends?: string;
    expires?: string;
    status?: string;
    messageType?: string;
  };
}

/** Severity ordering for display: most severe first. */
const SEVERITY_RANK: Record<string, number> = {
  Extreme: 0,
  Severe: 1,
  Moderate: 2,
  Minor: 3,
  Unknown: 4,
};

/**
 * Active NWS watches/warnings/advisories covering the playa — dust storm, high
 * wind, extreme heat, flash flood. Point-scoped so we only get alerts whose
 * polygon or zone actually contains Black Rock City. Cancelled/expired alerts
 * drop off this feed on their own, so an empty list means "nothing active".
 */
export async function fetchAlerts(): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${LATITUDE},${LONGITUDE}`,
      { headers: NWS_HEADERS },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: NwsAlertFeature[] };
    const features = data.features;
    if (!Array.isArray(features)) return [];

    const alerts: WeatherAlert[] = [];
    for (const feature of features) {
      const p = feature.properties;
      if (!p?.id || !p.event) continue;
      // "Actual" filters out the periodic Test/Exercise messages NWS emits.
      if (p.status && p.status !== "Actual") continue;
      const alert: WeatherAlert = {
        id: p.id,
        event: p.event,
        severity: p.severity ?? "Unknown",
        headline: p.headline ?? p.event,
      };
      if (p.onset) alert.onset = p.onset;
      const ends = p.ends ?? p.expires;
      if (ends) alert.ends = ends;
      alerts.push(alert);
    }

    return alerts.sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4),
    );
  } catch {
    return [];
  }
}
