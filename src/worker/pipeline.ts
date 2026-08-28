import { DAY_PROFILES, climatologyDays } from "../data/climatology";
import type { ForecastPayload } from "../shared/types";
import { computeDivergences, mergeDays } from "./merge";
import {
  fetchAlerts,
  fetchEcmwf,
  fetchGfs,
  fetchNWS,
  fetchOpenMeteoEnsemble,
  type NormalizedSource,
} from "./sources";
import { buildSummary } from "./summary";
import type { Env } from "./index";

/**
 * Full data pipeline: fetch all sources → validate/merge → optional AI summary.
 * `now` is injected so callers control the fetchedAt stamp (and tests stay
 * deterministic). Throws only if it genuinely cannot produce anything.
 */
export async function runPipeline(env: Env, now: Date): Promise<ForecastPayload> {
  const [ecmwf, gfs, ensemble, nws, alerts] = await Promise.all([
    fetchEcmwf(),
    fetchGfs(),
    fetchOpenMeteoEnsemble(),
    fetchNWS(),
    fetchAlerts(),
  ]);

  const sources: NormalizedSource[] = [ecmwf, gfs, nws].filter(
    (s): s is NormalizedSource => s !== null,
  );

  const days = mergeDays(DAY_PROFILES, sources, ensemble);
  const divergences = computeDivergences(DAY_PROFILES, sources);
  const summary = await buildSummary(env, days, divergences, alerts);

  const payload: ForecastPayload = { fetchedAt: now.toISOString(), days };
  if (summary) payload.summary = summary;
  if (alerts.length > 0) payload.alerts = alerts;
  return payload;
}

/** A climatology-only payload used when the pipeline has nothing to offer. */
export function climatologyPayload(now: Date): ForecastPayload {
  return { fetchedAt: now.toISOString(), days: climatologyDays() };
}
