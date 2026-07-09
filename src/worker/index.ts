import type { ForecastPayload } from "../shared/types";
import { climatologyPayload, runPipeline } from "./pipeline";
import { isStale, isWithinDailyWindow } from "./stale";

export interface Env {
  WEATHER_KV: KVNamespace;
  ASSETS: Fetcher;
  /** "true" enables the optional Anthropic outlook. */
  ENABLE_AI_SUMMARY?: string;
  /** Secret; only read when ENABLE_AI_SUMMARY === "true". */
  ANTHROPIC_API_KEY?: string;
}

const KV_KEY = "forecast";
const DAILY_CRON = "0 14 * * *";

function jsonResponse(payload: ForecastPayload, cacheSeconds: number): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `max-age=${cacheSeconds}`,
    },
  });
}

async function readPayload(env: Env): Promise<ForecastPayload | null> {
  const raw = await env.WEATHER_KV.get(KV_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ForecastPayload;
  } catch {
    return null;
  }
}

/** GET /api/forecast — serve KV, self-healing if empty or stale (>8 days). */
async function handleForecast(env: Env): Promise<Response> {
  const now = new Date();
  const stored = await readPayload(env);

  if (stored && !isStale(stored.fetchedAt, now)) {
    return jsonResponse(stored, 3600);
  }

  // KV empty or stale → run the pipeline inline before responding.
  try {
    const fresh = await runPipeline(env, now);
    await env.WEATHER_KV.put(KV_KEY, JSON.stringify(fresh));
    return jsonResponse(fresh, 3600);
  } catch {
    // Pipeline failed: fall back to whatever we had, else climatology.
    if (stored) return jsonResponse(stored, 300);
    return jsonResponse(climatologyPayload(now), 300);
  }
}

/** Scheduled refresh. Daily trigger no-ops outside the event window. */
async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const now = new Date();
  if (event.cron === DAILY_CRON && !isWithinDailyWindow(now)) {
    return; // daily cron only works within 10 days of the event
  }

  try {
    const fresh = await runPipeline(env, now);
    await env.WEATHER_KV.put(KV_KEY, JSON.stringify(fresh));
  } catch {
    // Total failure: keep the last good KV value untouched.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/forecast") {
      return handleForecast(env);
    }
    // Everything else is a static asset (Vite build output).
    return env.ASSETS.fetch(request);
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
