import type { DayData } from "../shared/types";
import type { Divergence } from "./merge";
import type { Env } from "./index";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

function fmtHour(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr} ${ampm}`;
}

function buildPrompt(days: DayData[], divergences: Divergence[]): string {
  const forecastDays = days.filter((d) => d.source === "forecast");
  const rows = (forecastDays.length ? forecastDays : days).map((d) => {
    const hi = Math.max(...d.temps);
    const lo = Math.min(...d.temps);
    const popPeak = Math.max(...d.precipProb);
    return `${d.date}: high ${hi}°F, low ${lo}°F, peak precip ${popPeak}%`;
  });

  const divLines = divergences
    .slice(0, 12)
    .map(
      (dv) =>
        `${dv.date} ${fmtHour(dv.hour)}: sources disagree on ${dv.kind} by ${Math.round(dv.spread)}${dv.kind === "temp" ? "°F" : "%"}`,
    );

  return [
    "You are writing a short practical weather outlook for people attending Burning Man 2026 in the Black Rock Desert, Nevada.",
    "",
    "Daily merged forecast:",
    ...rows,
    ...(divLines.length ? ["", "Hours where forecast models disagree (uncertainty):", ...divLines] : []),
    "",
    "Write 2–3 plain sentences of practical advice for attendees: when heat peaks, any storm risk, and how cold the nights get. Be specific and useful. No preamble, no bullet points, just the outlook.",
  ].join("\n");
}

/**
 * Optional AI-written outlook. Returns null (silently) when the feature is
 * disabled, the secret is missing, or the API call fails — the site never
 * depends on this succeeding.
 */
export async function buildSummary(
  env: Env,
  days: DayData[],
  divergences: Divergence[],
): Promise<string | null> {
  if (env.ENABLE_AI_SUMMARY !== "true") return null;
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: buildPrompt(days, divergences) }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
