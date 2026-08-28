import type { WeatherAlert } from "../shared/types";

interface AlertBannerProps {
  alerts: WeatherAlert[];
}

const endsFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

function formatEnds(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return endsFmt.format(d).toUpperCase();
}

/** Extreme/Severe alerts get the loud red treatment; the rest sit in amber. */
function severityStyle(severity: string): { border: string; text: string; glow: string } {
  if (severity === "Extreme" || severity === "Severe") {
    return { border: "#ff2d6f", text: "#ff6b9d", glow: "0 0 12px #ff2d6f60" };
  }
  return { border: "#ffb020", text: "#ffc95e", glow: "0 0 12px #ffb02050" };
}

/**
 * Active National Weather Service watches/warnings for the playa. Rendered
 * above everything else because a Dust Storm or Flash Flood Warning outranks
 * any hourly curve on the page.
 */
export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-5 space-y-2" aria-label="Active weather alerts">
      {alerts.map((alert) => {
        const style = severityStyle(alert.severity);
        const ends = formatEnds(alert.ends);
        return (
          <div
            key={alert.id}
            role="alert"
            className="cyber-chamfer border bg-background/90 px-4 py-3 backdrop-blur-sm"
            style={{ borderColor: style.border, boxShadow: style.glow }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span
                className="font-display text-[14px] font-bold uppercase tracking-[0.12em]"
                style={{ color: style.text, textShadow: `0 0 8px ${style.border}70` }}
              >
                ⚠ {alert.event}
              </span>
              <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {alert.severity}
                {ends && ` · until ${ends}`}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-foreground/90">
              {alert.headline}
            </p>
          </div>
        );
      })}
      <p className="px-1 font-tech text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Issued by the National Weather Service for Black Rock City
      </p>
    </section>
  );
}
