import { useEffect, useRef } from "react";

/**
 * Full-viewport canvas "purple rain" that falls behind all content (-z-10).
 * Every droplet gets randomized position, length, speed, width and opacity,
 * and is re-randomized when it recycles off the bottom — so there's no
 * repeating tile pattern.
 *
 * The cursor acts like an umbrella: an invisible circular shield (with a bit of
 * padding) surrounds the pointer, so raindrops falling onto it are stopped —
 * they splash on the dome and part around a dry bubble at the cursor.
 */
interface Drop {
  x: number;
  y: number;
  len: number;
  /** px per second */
  speed: number;
  width: number;
  alpha: number;
  /** 0 = far/dim purple, 1 = near/bright purple */
  tone: number;
}

interface Splash {
  x: number;
  y: number;
  /** 1 → 0 */
  life: number;
}

const ACCENT = "0, 255, 136";
/** Radius of the dry bubble around the cursor (the "umbrella" + padding). */
const SHIELD_R = 70;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function toneColor(tone: number, alpha: number): string {
  // Blend far purple (150,95,210) → near purple (206,148,255).
  const r = Math.round(150 + tone * (206 - 150));
  const g = Math.round(95 + tone * (148 - 95));
  const b = Math.round(210 + tone * (255 - 210));
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeDrop(width: number, height: number, fromTop: boolean): Drop {
  return {
    x: rand(0, width),
    y: fromTop ? rand(-height * 0.25, 0) : rand(0, height),
    len: rand(12, 46),
    speed: rand(280, 720),
    width: rand(0.6, 1.9),
    alpha: rand(0.12, 0.85),
    tone: Math.random(),
  };
}

export function RainBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let drops: Drop[] = [];
    const splashes: Splash[] = [];

    // Cursor / shield state.
    let mx = 0;
    let my = 0;
    let hovering = false;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      hovering = true;
    };
    const onLeave = () => {
      hovering = false;
    };

    const paintDrops = () => {
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.beginPath();
        ctx.lineWidth = d.width;
        ctx.strokeStyle = toneColor(d.tone, d.alpha);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
        ctx.stroke();
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Density scales with area, capped so 4K stays cheap.
      const count = Math.min(420, Math.round((width * height) / 9000));
      drops = Array.from({ length: count }, () => makeDrop(width, height, false));
      if (reduce) {
        ctx.clearRect(0, 0, width, height);
        paintDrops();
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);

    if (reduce) {
      // No animation: leave the static frame painted by resize().
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("mouseleave", onLeave);
        window.removeEventListener("blur", onLeave);
      };
    }

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      for (const d of drops) {
        const step = d.speed * dt;
        d.y += step;

        // Shield collision: stop drops landing on the dome around the cursor.
        if (hovering) {
          const dx = d.x - mx;
          if (Math.abs(dx) <= SHIELD_R) {
            // Top of the circle at this horizontal offset.
            const domeY = my - Math.sqrt(SHIELD_R * SHIELD_R - dx * dx);
            if (d.y + d.len >= domeY && d.y <= domeY + step + 2) {
              if (splashes.length < 80) splashes.push({ x: d.x, y: domeY, life: 1 });
              Object.assign(d, makeDrop(width, height, true));
              continue;
            }
          }
        }

        if (d.y - d.len > height) {
          // Recycle with brand-new randomness so the field never repeats.
          Object.assign(d, makeDrop(width, height, true));
        }
      }

      ctx.clearRect(0, 0, width, height);
      paintDrops();

      // Splashes fan off the dome where drops hit — this traces the invisible
      // shield without drawing a physical umbrella.
      ctx.lineCap = "round";
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i]!;
        s.life -= dt * 4;
        if (s.life <= 0) {
          splashes.splice(i, 1);
          continue;
        }
        const a = s.life;
        const spread = 7 * (1 - a) + 2;
        const rise = 5 * a;
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${ACCENT}, ${a * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - spread, s.y - rise);
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + spread, s.y - rise);
        ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
}
