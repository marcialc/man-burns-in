import { useEffect, useState } from "react";
import { climatologyDays } from "../data/climatology";
import type { DayData, ForecastPayload } from "../shared/types";

export interface WeatherState {
  days: DayData[];
  /** ISO timestamp from the API, once a live payload has loaded. */
  fetchedAt: string | null;
  summary: string | null;
  /** Union of contributingSources across forecast days. */
  sources: string[];
}

function initialState(): WeatherState {
  return { days: climatologyDays(), fetchedAt: null, summary: null, sources: [] };
}

/** Merge a live payload over the bundled climatology, day by day. */
function upgrade(base: DayData[], payload: ForecastPayload): WeatherState {
  const byDate = new Map(payload.days.map((d) => [d.date, d]));
  const days = base.map((clim) => {
    const live = byDate.get(clim.date);
    return live && live.source === "forecast" ? live : clim;
  });
  const sources = new Set<string>();
  for (const d of days) {
    if (d.source === "forecast" && d.contributingSources) {
      for (const s of d.contributingSources) sources.add(s);
    }
  }
  return {
    days,
    fetchedAt: payload.fetchedAt ?? null,
    summary: payload.summary ?? null,
    sources: [...sources],
  };
}

/**
 * Renders bundled climatology immediately, then fetches /api/forecast and
 * silently upgrades the days that come back as live forecasts.
 */
export function useWeatherData(): WeatherState {
  const [state, setState] = useState<WeatherState>(initialState);

  useEffect(() => {
    let cancelled = false;
    const base = climatologyDays();

    fetch("/api/forecast")
      .then((res) => (res.ok ? (res.json() as Promise<ForecastPayload>) : null))
      .then((payload) => {
        if (cancelled || !payload?.days) return;
        setState(upgrade(base, payload));
      })
      .catch(() => {
        // Network/API failure → keep the bundled climatology already showing.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
