// Types shared by the browser client and the Cloudflare Worker.

/** Static climatology profile for one event day (from Black Rock Desert history). */
export interface DayProfile {
  /** ISO date in America/Los_Angeles, e.g. "2026-08-30". */
  date: string;
  /** Short weekday label, e.g. "Sun". */
  dow: string;
  /** Full human label, e.g. "Sunday, August 30". */
  label: string;
  /** Short editorial note shown under the day title. */
  note: string;
  /** Modeled daily high (°F). */
  hi: number;
  /** Modeled daily low (°F). */
  lo: number;
  /** Peak hourly precipitation probability (%). */
  popPeak: number;
}

/** A National Weather Service watch/warning/advisory active over Black Rock City. */
export interface WeatherAlert {
  /** NWS alert id (stable per alert, used as a React key). */
  id: string;
  /** Event name, e.g. "Dust Storm Warning", "Flash Flood Warning". */
  event: string;
  /** NWS severity: Extreme | Severe | Moderate | Minor | Unknown. */
  severity: string;
  /** One-line human headline from the issuing office. */
  headline: string;
  /** ISO timestamp the alert takes effect (may be in the past). */
  onset?: string;
  /** ISO timestamp the alert expires. */
  ends?: string;
}

/** Uncertainty band (per-hour min/max °F) derived from sources + ensemble members. */
export interface TempBand {
  tempMin: number[];
  tempMax: number[];
}

/** Fully resolved weather for one event day, ready to render. */
export interface DayData {
  /** ISO date in America/Los_Angeles, e.g. "2026-08-30". */
  date: string;
  /** 24 hourly temperatures (°F), merged median across sources. */
  temps: number[];
  /** 24 hourly precipitation probabilities (%), merged median. */
  precipProb: number[];
  /** 24 hourly sustained wind speeds (mph), merged median. Absent on climatology days. */
  wind?: number[];
  /** 24 hourly wind gusts (mph), merged median. Absent when no source reports gusts. */
  gusts?: number[];
  /** Optional per-hour temperature spread for the shaded band. */
  band?: TempBand;
  /** Whether this day came from live forecasts or the climatology fallback. */
  source: "climatology" | "forecast";
  /** Names of the sources that contributed to a forecast day. */
  contributingSources?: string[];
}

/** Payload stored in KV and returned by GET /api/forecast. */
export interface ForecastPayload {
  /** ISO timestamp of when the pipeline last produced this payload. */
  fetchedAt: string;
  days: DayData[];
  /** Optional AI-written outlook (only present when the feature ran). */
  summary?: string;
  /** Active NWS alerts for the playa. Omitted when there are none. */
  alerts?: WeatherAlert[];
}

export type SyncReason = "manual" | "scheduled" | "self-heal";

/** One day or system-level item that changed during a sync. */
export interface ForecastChange {
  /** ISO date when this is tied to a forecast day. */
  date?: string;
  /** Human label for the changed day or system event. */
  label: string;
  /** Short human-readable field changes. */
  details: string[];
}

/** Persisted entry describing one forecast sync. */
export interface SyncLogEntry {
  id: string;
  syncedAt: string;
  reason: SyncReason;
  changed: boolean;
  summary: string;
  changes: ForecastChange[];
}

/** API response shape returned to the browser. */
export interface ForecastResponse extends ForecastPayload {
  changelog?: SyncLogEntry[];
}
