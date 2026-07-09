/** Format an hour-of-day (0–23) as "6 AM" / "12 PM". */
export function fmtHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr} ${ampm}`;
}
