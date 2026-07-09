import { useEffect, useState } from "react";
import { formatCountdown, resolvePhase } from "../lib/countdown";

/**
 * Live countdown to the next event milestone, rendered as a HUD terminal
 * readout. Ticks every second, pauses while the tab is hidden, clears its
 * interval on unmount. No digit flip/slide animation, so prefers-reduced-motion
 * needs no extra handling — updates are plain text swaps.
 */
export function Countdown() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let id: number | undefined;
    const tick = () => setNow(new Date());
    const start = () => {
      if (id === undefined) {
        tick();
        id = window.setInterval(tick, 1000);
      }
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const phase = resolvePhase(now);

  if (phase.target === undefined) {
    return (
      <div className="cyber-chamfer mx-auto mt-4 max-w-[420px] border border-accent/40 bg-card/60 px-5 py-3 shadow-neon">
        <div className="font-display text-[clamp(20px,6vw,30px)] font-bold uppercase tracking-widest text-accent [text-shadow:0_0_12px_#00ff8880]">
          {phase.label}
        </div>
      </div>
    );
  }

  const remaining = phase.target - now.getTime();

  return (
    <div className="cyber-chamfer mx-auto mt-4 inline-block border border-accent/40 bg-card/60 px-3 py-3 shadow-neon sm:px-6">
      {phase.label && (
        <div className="font-tech text-[11px] uppercase tracking-[0.3em] text-accent">
          <span className="text-muted-foreground">&gt;&gt;</span> {phase.label}
        </div>
      )}
      <div
        className={`${phase.label ? "mt-1" : ""} cyber-cursor whitespace-nowrap font-display text-[clamp(15px,4.6vw,38px)] font-black tabular-nums tracking-wide text-accent [text-shadow:0_0_10px_#00ff88,0_0_20px_#00ff8860] sm:tracking-wider`}
        aria-label={phase.label ? `${phase.label} ${formatCountdown(remaining)}` : formatCountdown(remaining)}
      >
        {formatCountdown(remaining)}
      </div>
    </div>
  );
}
