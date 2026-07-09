const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gates open: Aug 30 2026 00:01 PDT (UTC−7) → the daily-cron anchor. */
const EVENT_ANCHOR_MS = Date.UTC(2026, 7, 30, 7, 1, 0);

/** Payload counts as stale after 8 days (a missed Monday cron must self-heal). */
export const STALE_AFTER_DAYS = 8;

/**
 * True when the stored payload is missing/old enough that GET /api/forecast
 * should re-run the pipeline inline. Unparseable timestamps count as stale.
 */
export function isStale(fetchedAt: string | undefined | null, now: Date): boolean {
  if (!fetchedAt) return true;
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return true;
  return now.getTime() - ts > STALE_AFTER_DAYS * MS_PER_DAY;
}

/**
 * Gate for the daily cron: it does real work only within 10 days of the event
 * anchor (Aug 30 2026). Outside that window the daily trigger no-ops so we don't
 * hammer the sources year-round; the weekly Monday cron always runs.
 */
export function isWithinDailyWindow(now: Date): boolean {
  return Math.abs(now.getTime() - EVENT_ANCHOR_MS) <= 10 * MS_PER_DAY;
}
