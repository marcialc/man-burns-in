import { DAY_PROFILES } from "../data/climatology";
import type { DayData, ForecastPayload, SyncLogEntry, SyncReason } from "../shared/types";

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

  return details;
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
  const changes = next.days.flatMap((day) => {
    const oldDay = previousByDate.get(day.date);
    if (!oldDay) {
      return [{ date: day.date, label: dayLabel(day), details: ["day added"] }];
    }

    const details = buildDayDetails(oldDay, day);
    return details.length > 0 ? [{ date: day.date, label: dayLabel(day), details }] : [];
  });

  const nextDates = new Set(next.days.map((day) => day.date));
  for (const oldDay of previous.days) {
    if (!nextDates.has(oldDay.date)) {
      changes.push({ date: oldDay.date, label: dayLabel(oldDay), details: ["day removed"] });
    }
  }

  const summary =
    changes.length === 0
      ? `No forecast values changed after ${reasonLabel(reason)} sync.`
      : `${changes.length} day${changes.length === 1 ? "" : "s"} updated by ${reasonLabel(reason)} sync.`;

  return {
    id: `${next.fetchedAt}-${reason}`,
    syncedAt: next.fetchedAt,
    reason,
    changed: changes.length > 0,
    summary,
    changes,
  };
}
