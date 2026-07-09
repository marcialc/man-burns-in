import { Countdown } from "./Countdown";

/** Title, glitched headline, and live countdown. */
export function Header() {
  return (
    <header className="relative overflow-hidden border-b-2 border-accent/60 px-[18px] pb-8 pt-[max(28px,env(safe-area-inset-top))] text-center shadow-[0_10px_40px_-20px_#00ff88]">
      {/* Neon corner mesh behind the masthead. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 120% at 50% -20%, rgba(0,255,136,0.10), transparent 60%), radial-gradient(40% 80% at 100% 0%, rgba(255,0,255,0.10), transparent 70%)",
        }}
      />

      <div className="font-tech text-[10px] uppercase tracking-[0.35em] text-accent-tertiary">
        BLACK ROCK DESERT · GERLACH, NV · 3,907 FT
      </div>

      <h1
        className="cyber-glitch mt-3 font-display text-[clamp(26px,8vw,52px)] font-black uppercase leading-[0.95] tracking-[0.06em] text-foreground [text-shadow:0_0_14px_rgba(0,255,136,0.35)] motion-safe:animate-rgb-shift"
        data-text="BURNING MAN IN_"
      >
        BURNING MAN <span className="text-accent">IN</span>
        <span className="cyber-cursor" />
      </h1>

      <div className="mt-2 font-tech text-[12px] uppercase tracking-[0.25em] text-muted-foreground">
        BURNING MAN 2026 // AUG 30 → SEP 07
      </div>

      <Countdown />
    </header>
  );
}
