import type { ForecastPayload, ForecastResponse, SyncLogEntry, SyncReason } from "../shared/types";
import { buildSyncLogEntry } from "./changelog";
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
const CHANGELOG_KV_KEY = "forecast-changelog";
const MAX_CHANGELOG_ENTRIES = 12;
const DAILY_CRON = "0 14 * * *";

function jsonResponse(payload: ForecastResponse, cacheSeconds: number): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `max-age=${cacheSeconds}`,
    },
  });
}

function noStoreJsonResponse(payload: ForecastResponse): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
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

async function readChangelog(env: Env): Promise<SyncLogEntry[]> {
  const raw = await env.WEATHER_KV.get(CHANGELOG_KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SyncLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function withChangelog(payload: ForecastPayload, changelog: SyncLogEntry[]): ForecastResponse {
  return changelog.length > 0 ? { ...payload, changelog } : payload;
}

async function writePayloadWithChangelog(
  env: Env,
  previous: ForecastPayload | null,
  fresh: ForecastPayload,
  reason: SyncReason,
): Promise<SyncLogEntry[]> {
  const entry = buildSyncLogEntry(previous, fresh, reason);
  const changelog = [entry, ...(await readChangelog(env))].slice(0, MAX_CHANGELOG_ENTRIES);
  await Promise.all([
    env.WEATHER_KV.put(KV_KEY, JSON.stringify(fresh)),
    env.WEATHER_KV.put(CHANGELOG_KV_KEY, JSON.stringify(changelog)),
  ]);
  return changelog;
}

/** GET /api/forecast — serve KV, self-healing if empty or stale (>8 days). */
async function handleForecast(env: Env): Promise<Response> {
  const now = new Date();
  const stored = await readPayload(env);

  if (stored && !isStale(stored.fetchedAt, now)) {
    return jsonResponse(withChangelog(stored, await readChangelog(env)), 3600);
  }

  // KV empty or stale → run the pipeline inline before responding.
  try {
    const fresh = await runPipeline(env, now);
    const changelog = await writePayloadWithChangelog(env, stored, fresh, "self-heal");
    return jsonResponse(withChangelog(fresh, changelog), 3600);
  } catch {
    // Pipeline failed: fall back to whatever we had, else climatology.
    if (stored) return jsonResponse(withChangelog(stored, await readChangelog(env)), 300);
    return jsonResponse(climatologyPayload(now), 300);
  }
}

/** POST /api/forecast/sync — force a fresh pipeline run and update KV. */
async function handleManualSync(env: Env): Promise<Response> {
  try {
    const previous = await readPayload(env);
    const fresh = await runPipeline(env, new Date());
    const changelog = await writePayloadWithChangelog(env, previous, fresh, "manual");
    return noStoreJsonResponse(withChangelog(fresh, changelog));
  } catch {
    return new Response(JSON.stringify({ error: "Unable to refresh forecast data." }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

/** Scheduled refresh. Daily trigger no-ops outside the event window. */
async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const now = new Date();
  if (event.cron === DAILY_CRON && !isWithinDailyWindow(now)) {
    return; // daily cron only works within 10 days of the event
  }

  try {
    const previous = await readPayload(env);
    const fresh = await runPipeline(env, now);
    await writePayloadWithChangelog(env, previous, fresh, "scheduled");
  } catch {
    // Total failure: keep the last good KV value untouched.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/forecast/sync") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { allow: "POST" },
        });
      }
      return handleManualSync(env);
    }
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
