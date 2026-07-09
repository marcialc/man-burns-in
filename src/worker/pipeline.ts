import { DAY_PROFILES, climatologyDays } from "../data/climatology";
import type { ForecastPayload } from "../shared/types";
import { computeDivergences, mergeDays } from "./merge";
import {
  fetchNWS,
  fetchOpenMeteoEnsemble,
  fetchOpenMeteoForecast,
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
  const [openMeteo, ensemble, nws] = await Promise.all([
    fetchOpenMeteoForecast(),
    fetchOpenMeteoEnsemble(),
    fetchNWS(),
  ]);

  const sources: NormalizedSource[] = [openMeteo, nws].filter(
    (s): s is NormalizedSource => s !== null,
  );

  const days = mergeDays(DAY_PROFILES, sources, ensemble);
  const divergences = computeDivergences(DAY_PROFILES, sources);
  const summary = await buildSummary(env, days, divergences);

  const payload: ForecastPayload = { fetchedAt: now.toISOString(), days };
  if (summary) payload.summary = summary;
  return payload;
}

/** A climatology-only payload used when the pipeline has nothing to offer. */
export function climatologyPayload(now: Date): ForecastPayload {
  return { fetchedAt: now.toISOString(), days: climatologyDays() };
}
