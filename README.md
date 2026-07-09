# man-burns-in — "The Man Burns In…"

Hour-by-hour weather for **Burning Man 2026** (Black Rock City, Aug 30 – Sep 7),
with a live countdown to the burn. React + Vite client served by a single
Cloudflare Worker that runs a multi-source weather pipeline on a cron and caches
the result in KV.

## Stack

- Vite + React 18 + TypeScript (strict)
- Tailwind CSS (theme ported from the reference design's CSS custom properties)
- Cloudflare Worker: static assets + `/api/forecast` + scheduled data pipeline
- KV namespace `WEATHER_KV`

## Scripts

```bash
npm install
npm run dev        # Vite dev server (client only; /api/forecast 404s → bundled climatology)
npm run test       # vitest: merge, validation, source resolution, stale, cron gate, phases
npm run typecheck  # client + worker
npm run build      # → dist/
npm run cf-dev     # build + wrangler dev (exercises the Worker + pipeline locally)
npm run deploy     # build + wrangler deploy
```

## Data pipeline

The Worker (never the browser) fetches three sources and merges them in
`src/worker/merge.ts` (pure, unit-tested):

1. **Open-Meteo forecast** — deterministic hourly temp + precip probability.
2. **Open-Meteo ensemble** — ~30 members → per-hour temp min/max for the band.
3. **NWS** — hourly forecast (via the `points` → `forecastHourly` grid lookup).

Per hour/metric it takes the **median** across valid sources; per hour it takes
min/max across sources + ensemble members for the uncertainty band. A date with
no valid source falls back to the bundled **climatology** (`src/data/climatology.ts`,
ported from the reference HTML and shared by client and worker). Sources are
validated per-date (no nulls, temps −20…130 °F, precip 0–100 %, exactly 24
values) and rejected individually on failure — never the whole run.

Before mid-August 2026 the forecast APIs return little/nothing for the event
window; that's expected and handled per-day.

### Optional AI outlook

Gated behind `ENABLE_AI_SUMMARY="true"` **and** the `ANTHROPIC_API_KEY` secret.
Makes one `claude-haiku-4-5-20251001` call with the merged hi/lo, precip peaks,
and the hours where sources diverge (>8 °F or >20 %). If disabled or it fails,
it's skipped silently — the site is fully functional without it.

## Deploy

```bash
wrangler kv namespace create WEATHER_KV   # paste the id into wrangler.toml
# optional:
wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

### Scheduling & self-heal

Crons: weekly Monday + daily (`src/worker/stale.ts` `isWithinDailyWindow` makes
the daily run a no-op unless within 10 days of Aug 30 2026). `GET /api/forecast`
serves the KV payload; if KV is empty or `fetchedAt` is >8 days old
(`isStale`), it runs the pipeline inline first, so a missed Monday cron never
means a week of stale data.

## Client behavior

Renders bundled climatology immediately (no skeleton), then fetches
`/api/forecast` and silently upgrades the days marked `source: "forecast"`. Each
day panel badges "Live forecast" vs "Climate estimate"; the header disclaimer
reflects the mix and the footer shows the update time + contributing sources.
The temperature curve draws the uncertainty band behind the median line when
present.
