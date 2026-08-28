import { DAY_PROFILES } from "../data/climatology";
import type {
  DayData,
  ForecastChange,
  ForecastPayload,
  SyncLogEntry,
  SyncReason,
  WeatherAlert,
} from "../shared/types";

const labelByDate = new Map(DAY_PROFILES.map((d) => [d.date, d.label]));

function dayLabel(day: DayData): string {
  return labelByDate.get(day.date) ?? day.date;
}

function max(values: number[]): number {
  return Math.max(...values);
}

function min(values: number[]): number {
  return Math.min(...values);
}

function sourceLabel(source: DayData["source"]): string {
  return source === "forecast" ? "live forecast" : "climate sim";
}

function sourcesLabel(day: DayData): string {
  return day.contributingSources?.length ? day.contributingSources.join(" / ") : "none";
}

function sameNumbers(a: number[] | undefined, b: number[] | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

function sameBand(a: DayData["band"], b: DayData["band"]): boolean {
  if (!a || !b) return a === b;
  return sameNumbers(a.tempMin, b.tempMin) && sameNumbers(a.tempMax, b.tempMax);
}

/** "peak 24 mph" style summary of an optional wind series. */
function peakOrNone(values: number[] | undefined): string {
  return values ? `${max(values)}` : "none";
}

function buildDayDetails(previous: DayData, next: DayData): string[] {
  const details: string[] = [];
  const prevHi = max(previous.temps);
  const nextHi = max(next.temps);
  const prevLo = min(previous.temps);
  const nextLo = min(next.temps);
  const prevPeakRain = max(previous.precipProb);
  const nextPeakRain = max(next.precipProb);
  const prevSources = sourcesLabel(previous);
  const nextSources = sourcesLabel(next);

  if (previous.source !== next.source) {
    details.push(`source ${sourceLabel(previous.source)} -> ${sourceLabel(next.source)}`);
  }
  if (prevSources !== nextSources) {
    details.push(`sources ${prevSources} -> ${nextSources}`);
  }
  if (prevHi !== nextHi) {
    details.push(`high ${prevHi}F -> ${nextHi}F`);
  }
  if (prevLo !== nextLo) {
    details.push(`low ${prevLo}F -> ${nextLo}F`);
  }
  if (prevPeakRain !== nextPeakRain) {
    details.push(`peak rain ${prevPeakRain}% -> ${nextPeakRain}%`);
  }
  if (sameNumbers(previous.temps, next.temps) === false && prevHi === nextHi && prevLo === nextLo) {
    details.push("hourly temperature curve changed");
  }
  if (sameNumbers(previous.precipProb, next.precipProb) === false && prevPeakRain === nextPeakRain) {
    details.push("hourly rain curve changed");
  }
  if (!sameBand(previous.band, next.band)) {
    details.push("temperature range band changed");
  }

  const prevPeakWind = peakOrNone(previous.wind);
  const nextPeakWind = peakOrNone(next.wind);
  if (prevPeakWind !== nextPeakWind) {
    details.push(`peak wind ${prevPeakWind} -> ${nextPeakWind} mph`);
  } else if (!sameNumbers(previous.wind, next.wind)) {
    details.push("hourly wind curve changed");
  }

  const prevPeakGust = peakOrNone(previous.gusts);
  const nextPeakGust = peakOrNone(next.gusts);
  if (prevPeakGust !== nextPeakGust) {
    details.push(`peak gust ${prevPeakGust} -> ${nextPeakGust} mph`);
  }

  return details;
}

/**
 * Alerts are a system-level change, not a per-day one: an NWS warning
 * appearing or clearing is the single most important thing a sync can report,
 * so it gets its own entry pinned to the top of the change list.
 */
function buildAlertChange(previous: WeatherAlert[], next: WeatherAlert[]): ForecastChange | null {
  const prevIds = new Set(previous.map((a) => a.id));
  const nextIds = new Set(next.map((a) => a.id));
  const added = next.filter((a) => !prevIds.has(a.id));
  const cleared = previous.filter((a) => !nextIds.has(a.id));
  if (added.length === 0 && cleared.length === 0) return null;

  const details = [
    ...added.map((a) => `ISSUED ${a.event} (${a.severity})`),
    ...cleared.map((a) => `cleared ${a.event}`),
  ];
  return { label: "NWS alerts", details };
}

/**
 * One-line headline for a sync. Alerts lead when present — they matter more
 * than any number of degrees moving around.
 */
function buildSummaryLine(
  dayCount: number,
  alertChange: ForecastChange | null,
  reason: SyncReason,
): string {
  const parts: string[] = [];
  if (alertChange) parts.push(alertChange.details.join("; "));
  if (dayCount > 0) parts.push(`${dayCount} day${dayCount === 1 ? "" : "s"} updated`);
  if (parts.length === 0) return `No forecast values changed after ${reasonLabel(reason)} sync.`;
  return `${parts.join(" · ")} by ${reasonLabel(reason)} sync.`;
}

function reasonLabel(reason: SyncReason): string {
  if (reason === "manual") return "manual";
  if (reason === "scheduled") return "scheduled";
  return "self-heal";
}

export function buildSyncLogEntry(
  previous: ForecastPayload | null,
  next: ForecastPayload,
  reason: SyncReason,
): SyncLogEntry {
  if (!previous) {
    return {
      id: `${next.fetchedAt}-${reason}`,
      syncedAt: next.fetchedAt,
      reason,
      changed: true,
      summary: `Forecast cache initialized by ${reasonLabel(reason)} sync.`,
      changes: [
        {
          label: "Forecast cache",
          details: [`initialized ${next.days.length} event days`],
        },
      ],
    };
  }

  const previousByDate = new Map(previous.days.map((day) => [day.date, day]));
  const changes: ForecastChange[] = next.days.flatMap((day) => {
    const oldDay = previousByDate.get(day.date);
    if (!oldDay) {
      return [{ date: day.date, label: dayLabel(day), details: ["day added"] }];
    }

    const details = buildDayDetails(oldDay, day);
    return details.length > 0 ? [{ date: day.date, label: dayLabel(day), details }] : [];
  });

  const alertChange = buildAlertChange(previous.alerts ?? [], next.alerts ?? []);
  if (alertChange) changes.unshift(alertChange);

  const nextDates = new Set(next.days.map((day) => day.date));
  for (const oldDay of previous.days) {
    if (!nextDates.has(oldDay.date)) {
      changes.push({ date: oldDay.date, label: dayLabel(oldDay), details: ["day removed"] });
    }
  }

  const dayCount = changes.filter((change) => change.date !== undefined).length;
  const summary = buildSummaryLine(dayCount, alertChange, reason);

  return {
    id: `${next.fetchedAt}-${reason}`,
    syncedAt: next.fetchedAt,
    reason,
    changed: changes.length > 0,
    summary,
    changes,
  };
}
