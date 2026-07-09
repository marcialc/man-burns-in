// Countdown phase resolution. All target instants are fixed points in
// America/Los_Angeles (PDT, UTC−7 on these dates), encoded as absolute UTC ms so
// the visitor's local timezone never affects the result.

/** Gates open: Aug 30 2026 00:01 PDT. */
export const GATES_OPEN_MS = Date.UTC(2026, 7, 30, 7, 1, 0);
/** The Man burns: Sat Sep 5 2026 21:00 PDT. */
export const MAN_BURN_MS = Date.UTC(2026, 8, 6, 4, 0, 0);
/** The Temple burns: Sun Sep 6 2026 20:00 PDT. */
export const TEMPLE_BURN_MS = Date.UTC(2026, 8, 7, 3, 0, 0);

export type PhaseKind = "before" | "onPlaya" | "betweenBurns" | "after";

export interface Phase {
  kind: PhaseKind;
  label: string;
  /** Target instant (epoch ms) to count down to; absent once the event is over. */
  target?: number;
}

/** Resolve which countdown phase `now` falls into. */
export function resolvePhase(now: Date): Phase {
  const t = now.getTime();
  if (t < GATES_OPEN_MS) {
    return { kind: "before", label: "", target: GATES_OPEN_MS };
  }
  if (t < MAN_BURN_MS) {
    return { kind: "onPlaya", label: "The Man burns in", target: MAN_BURN_MS };
  }
  if (t < TEMPLE_BURN_MS) {
    return { kind: "betweenBurns", label: "The Temple burns in", target: TEMPLE_BURN_MS };
  }
  return { kind: "after", label: "See you in the dust 🔥" };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Format a remaining duration (ms) as "53d 04h 12m 09s". Clamps negatives to zero. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}
