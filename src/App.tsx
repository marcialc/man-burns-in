import { useState } from "react";
import { DAY_PROFILES } from "./data/climatology";
import { useWeatherData } from "./hooks/useWeatherData";
import { DayStrip } from "./components/DayStrip";
import { Header } from "./components/Header";
import { HourlyCurve } from "./components/HourlyCurve";
import { MetricToggle, type Metric } from "./components/MetricToggle";
import { RainBackground } from "./components/RainBackground";
import { Summary } from "./components/Summary";
import type { SyncLogEntry } from "./shared/types";

const fetchedFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fetchedFmt.format(d).toUpperCase();
}

function dataNote(forecastCount: number, totalDays: number): string {
  if (forecastCount === 0) {
    return "Expected values are modeled from Black Rock Desert climate history, not a live forecast. Live forecasts usually become useful about 7-10 days out. Expect swings of about 10°F; one storm can turn the playa into concrete-like mud.";
  }
  if (forecastCount === totalDays) {
    return `Live forecasts cover all ${totalDays} days and are merged from multiple weather models. Conditions still shift fast in the desert, so expect swings of about 10°F.`;
  }
  return `Live forecasts cover ${forecastCount} of ${totalDays} days; the remaining days use climate-history modeling until forecasts are close enough, usually about 7-10 days out. Expect swings of about 10°F.`;
}

export function App() {
  const weather = useWeatherData();
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Metric>("temp");

  const days = weather.days;
  const forecastCount = days.filter((d) => d.source === "forecast").length;

  const day = days[active] ?? days[0];
  const profile = DAY_PROFILES[active];
  if (!day || !profile) return null;

  const isT = mode === "temp";
  const values = isT ? day.temps : day.precipProb;
  const band = isT && day.band ? { min: day.band.tempMin, max: day.band.tempMax } : undefined;

  const hi = Math.max(...day.temps);
  const lo = Math.min(...day.temps);
  const popPeak = Math.max(...day.precipProb);
  const isForecast = day.source === "forecast";

  return (
    <>
      <RainBackground />
      <Header />

      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-main">
          <DayStrip days={days} activeIndex={active} onSelect={setActive} />
          <MetricToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      <main className="mx-auto max-w-main px-3.5 pb-16 pt-6">
        <SyncPanel
          fetchedAt={weather.fetchedAt}
          isRefreshing={weather.isRefreshing}
          refreshError={weather.refreshError}
          sources={weather.sources}
          changelog={weather.changelog}
          onRefresh={() => {
            void weather.refresh();
          }}
        />

        {weather.summary && <Summary text={weather.summary} />}

        <div key={`${active}-${mode}`} className="day-panel">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-display text-[clamp(20px,5vw,28px)] font-bold uppercase tracking-wide text-foreground">
                {profile.label}
              </div>
              <div className="mt-0.5 font-tech text-[12px] uppercase tracking-[0.15em] text-muted-foreground">
                {profile.note}
              </div>
            </div>
            <div className="font-tech text-[13.5px] uppercase tracking-wide">
              {isT ? (
                <>
                  <span className="text-muted-foreground">HI</span>{" "}
                  <span className="font-bold text-[#ff5e3a] [text-shadow:0_0_8px_#ff5e3a70]">{hi}°F</span>
                  <span className="mx-1.5 text-border">│</span>
                  <span className="text-muted-foreground">LO</span>{" "}
                  <span className="font-bold text-accent-tertiary [text-shadow:0_0_8px_#00d4ff70]">{lo}°F</span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">PEAK RAIN</span>{" "}
                  <span className="font-bold text-accent-tertiary [text-shadow:0_0_8px_#00d4ff70]">{popPeak}%</span>
                </>
              )}
            </div>
          </div>

          {/* Source badge. */}
          <div className="mb-3">
            <span
              className={`cyber-chamfer-sm inline-block border px-3 py-1 font-tech text-[10px] uppercase tracking-[0.2em] ${
                isForecast
                  ? "border-accent/60 text-accent shadow-neon-sm"
                  : "border-border text-muted-foreground"
              }`}
              title={
                isForecast && day.contributingSources
                  ? `Sources: ${day.contributingSources.join(", ")}`
                  : undefined
              }
            >
              {isForecast ? "◉ LIVE FORECAST" : "◎ CLIMATE SIM"}
            </span>
          </div>

          {/* Holographic chart panel with HUD corner accents. */}
          <div className="relative mb-2 border border-accent/25 bg-[#0c0720]/90 px-1.5 pb-1 pt-3 shadow-neon-sm backdrop-blur-sm">
            <CornerAccents />
            <HourlyCurve values={values} band={band} mode={mode} />
          </div>
          <p className="text-center font-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            hover the graph to scan any hour
          </p>
        </div>
      </main>

      <footer className="border-t border-border px-4 pb-[calc(36px+env(safe-area-inset-bottom))] pt-8 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
        <div className="mx-auto max-w-[620px] space-y-1.5">
          <p>
            <span className="text-accent-tertiary">//</span> Coldest before sunrise (~06:25), hottest
            ~16:00–17:00. Sunrise ≈ 06:25 · Sunset ≈ 19:25 PDT.
          </p>
          <p>
            <span className="text-accent-tertiary">//</span> Late-summer rain is rare but
            consequential — even 0.1&quot; shuts down driving on the playa.
          </p>
          <p>
            <span className="text-accent-tertiary">//</span> {dataNote(forecastCount, days.length)}
          </p>
          <p>
            <span className="text-accent-tertiary">//</span> Data refreshes every Monday, then daily
            within 10 days of Aug 30, 2026; live API responses may cache for up to 1 hour.
          </p>
          <p>
            <span className="text-accent-tertiary">//</span> Weather data comes from{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-tertiary underline decoration-accent-tertiary/40 underline-offset-4 hover:text-accent"
            >
              Open-Meteo
            </a>
            ,{" "}
            <a
              href="https://open-meteo.com/en/docs/ensemble-api"
              target="_blank"
              rel="noreferrer"
              className="text-accent-tertiary underline decoration-accent-tertiary/40 underline-offset-4 hover:text-accent"
            >
              Open-Meteo ensemble models
            </a>
            , and the{" "}
            <a
              href="https://www.weather.gov/documentation/services-web-api"
              target="_blank"
              rel="noreferrer"
              className="text-accent-tertiary underline decoration-accent-tertiary/40 underline-offset-4 hover:text-accent"
            >
              National Weather Service
            </a>
            ; out-of-range days use Black Rock Desert climatology.
          </p>
          {weather.fetchedAt && (
            <p className="pt-2 font-tech uppercase tracking-[0.15em] text-muted-foreground/70">
              &gt; FEED SYNCED {formatFetchedAt(weather.fetchedAt)}
              {weather.sources.length > 0 && <> · SRC: {weather.sources.join(" / ")}</>}
            </p>
          )}
        </div>
      </footer>
    </>
  );
}

interface SyncPanelProps {
  fetchedAt: string | null;
  isRefreshing: boolean;
  refreshError: string | null;
  sources: string[];
  changelog: SyncLogEntry[];
  onRefresh: () => void;
}

function SyncPanel({
  fetchedAt,
  isRefreshing,
  refreshError,
  sources,
  changelog,
  onRefresh,
}: SyncPanelProps) {
  const latest = changelog[0];

  return (
    <section className="cyber-chamfer mb-5 border border-accent/30 bg-background/90 px-4 py-3 shadow-neon-sm backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-tech text-[10px] uppercase tracking-[0.24em] text-accent-tertiary">
            Last sync
          </div>
          <div className="mt-1 font-tech text-[13px] uppercase tracking-[0.12em] text-foreground">
            {fetchedAt ? formatFetchedAt(fetchedAt) : "No live update yet"}
          </div>
          {sources.length > 0 && (
            <div className="mt-1 truncate font-tech text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              SRC: {sources.join(" / ")}
            </div>
          )}
          {refreshError && (
            <div className="mt-2 font-tech text-[10px] uppercase tracking-[0.14em] text-[#ff5e3a]">
              {refreshError}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="cyber-chamfer-sm border border-accent/70 px-4 py-2 font-tech text-[11px] uppercase tracking-[0.2em] text-accent shadow-neon-sm transition hover:border-accent hover:bg-accent/10 disabled:cursor-wait disabled:border-border disabled:text-muted-foreground disabled:shadow-none"
        >
          {isRefreshing ? "Syncing..." : "Sync now"}
        </button>
      </div>

      <div className="mt-3 border-t border-border/80 pt-3">
        <div className="font-tech text-[10px] uppercase tracking-[0.24em] text-accent-tertiary">
          Latest update
        </div>
        {latest ? (
          <div className="mt-2 space-y-2">
            <p className="font-mono text-[12px] leading-relaxed text-foreground/90">{latest.summary}</p>
            {latest.changes.length > 0 && (
              <ul className="space-y-1.5">
                {latest.changes.slice(0, 4).map((change) => (
                  <li key={`${latest.id}-${change.date ?? change.label}`} className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                    <span className="text-foreground/90">{change.label}:</span>{" "}
                    {change.details.join(" | ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted-foreground">
            Change log will appear after the next successful sync.
          </p>
        )}

        {changelog.length > 1 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent-tertiary">
              Overall changelog
            </summary>
            <div className="mt-2 space-y-2">
              {changelog.slice(1, 6).map((entry) => (
                <div key={entry.id} className="border-t border-border/60 pt-2">
                  <div className="font-tech text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {formatFetchedAt(entry.syncedAt)} // {entry.reason}
                  </div>
                  <div className="mt-1 font-mono text-[11px] leading-relaxed text-foreground/85">
                    {entry.summary}
                  </div>
                  {entry.changes.length > 0 && (
                    <div className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {entry.changes
                        .slice(0, 3)
                        .map((change) => `${change.label}: ${change.details.join(" | ")}`)
                        .join(" / ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** Four L-shaped neon corner brackets for the holographic panel. */
function CornerAccents() {
  const common = "pointer-events-none absolute h-3 w-3 border-accent/70";
  return (
    <span aria-hidden>
      <span className={`${common} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${common} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${common} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${common} bottom-0 right-0 border-b-2 border-r-2`} />
    </span>
  );
}
