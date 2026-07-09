import { DAY_PROFILES } from "../data/climatology";
import type { DayData } from "../shared/types";

interface DayStripProps {
  days: DayData[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const shortDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function shortDate(iso: string): string {
  return shortDateFmt.format(new Date(`${iso}T12:00:00Z`)).toUpperCase();
}

/** Sticky horizontal day selector (9 days, Aug 30 – Sep 7 2026). */
export function DayStrip({ days, activeIndex, onSelect }: DayStripProps) {
  return (
    <nav
      className="no-scrollbar flex gap-2 overflow-x-auto px-3.5 pb-2 pt-3 min-[700px]:overflow-x-visible"
      aria-label="Select a day"
    >
      {days.map((d, i) => {
        const profile = DAY_PROFILES.find((p) => p.date === d.date);
        const hi = Math.max(...d.temps);
        const lo = Math.min(...d.temps);
        const active = i === activeIndex;
        const live = d.source === "forecast";
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelect(i)}
            aria-pressed={active}
            className={`cyber-chamfer-sm relative min-h-[68px] min-w-[80px] flex-none snap-start border bg-card px-1.5 py-2 text-center font-tech transition-[box-shadow,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-[700px]:flex-1 ${
              active
                ? "border-accent bg-accent/[0.08] text-foreground shadow-neon"
                : "border-border text-foreground/80 hover:border-accent/60 hover:shadow-neon-sm"
            }`}
          >
            {/* Live/estimate status pip. */}
            <span
              className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 ${live ? "bg-accent shadow-neon-sm" : "bg-muted-foreground/50"}`}
              aria-hidden
            />
            <span className={`block text-[10px] uppercase tracking-[0.2em] ${active ? "text-accent" : "opacity-60"}`}>
              {profile?.dow}
            </span>
            <span className="mt-0.5 block font-display text-[13px] font-bold tracking-wide">
              {shortDate(d.date)}
            </span>
            <span className="mt-1 block text-[10.5px]">
              <span style={{ color: "#ff5e3a" }}>{hi}°</span>
              <span className="text-muted-foreground">/</span>
              <span style={{ color: "#00d4ff" }}>{lo}°</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
