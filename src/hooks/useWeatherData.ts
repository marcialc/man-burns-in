import { useCallback, useEffect, useState } from "react";
import { climatologyDays } from "../data/climatology";
import type { DayData, ForecastResponse, SyncLogEntry } from "../shared/types";

export interface WeatherState {
  days: DayData[];
  /** ISO timestamp from the API, once a live payload has loaded. */
  fetchedAt: string | null;
  summary: string | null;
  /** Union of contributingSources across forecast days. */
  sources: string[];
  /** Recent persisted sync/update entries from the API. */
  changelog: SyncLogEntry[];
}

export interface WeatherData extends WeatherState {
  isRefreshing: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
}

function initialState(): WeatherState {
  return { days: climatologyDays(), fetchedAt: null, summary: null, sources: [], changelog: [] };
}

/** Merge a live payload over the bundled climatology, day by day. */
function upgrade(base: DayData[], payload: ForecastResponse): WeatherState {
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
    changelog: payload.changelog ?? [],
  };
}

/**
 * Renders bundled climatology immediately, then fetches /api/forecast and
 * silently upgrades the days that come back as live forecasts.
 */
export function useWeatherData(): WeatherData {
  const [state, setState] = useState<WeatherState>(initialState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const applyPayload = useCallback((payload: ForecastResponse) => {
    setState(upgrade(climatologyDays(), payload));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/forecast")
      .then((res) => (res.ok ? (res.json() as Promise<ForecastResponse>) : null))
      .then((payload) => {
        if (cancelled || !payload?.days) return;
        applyPayload(payload);
      })
      .catch(() => {
        // Network/API failure → keep the bundled climatology already showing.
      });

    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/forecast/sync", { method: "POST" });
      if (!res.ok) throw new Error(`Sync failed with ${res.status}`);
      const payload = (await res.json()) as ForecastResponse;
      if (!payload?.days) throw new Error("Sync response was missing forecast days");
      applyPayload(payload);
    } catch {
      setRefreshError("Sync failed. Try again in a minute.");
    } finally {
      setIsRefreshing(false);
    }
  }, [applyPayload]);

  return { ...state, isRefreshing, refreshError, refresh };
}
