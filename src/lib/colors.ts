export interface Swatch {
  /** Neon hue for this band — drives border, text, and glow on the dark card. */
  hue: string;
  tag: string;
}

/**
 * Temperature → neon hue + tag. The spectrum runs hot→cold across the
 * cyberpunk palette (magenta-pink → orange → amber → green → cyan → blue) so
 * the data still reads as warm/cool while staying in-system. Thresholds match
 * the reference design.
 */
export function tempColor(t: number): Swatch {
  if (t >= 90) return { hue: "#ff2d6f", tag: "scorching" };
  if (t >= 80) return { hue: "#ff5e3a", tag: "hot" };
  if (t >= 70) return { hue: "#ffb020", tag: "warm" };
  if (t >= 60) return { hue: "#00ff88", tag: "mild" };
  if (t >= 50) return { hue: "#00d4ff", tag: "chilly" };
  return { hue: "#4d7fff", tag: "cold — layer up" };
}

/**
 * Precip probability → neon hue + tag, on the cyan/tertiary axis (water reads
 * as electric blue). Dry drops to muted so it recedes.
 */
export function precipColor(p: number): Swatch {
  if (p >= 15) return { hue: "#00d4ff", tag: "t-storm possible" };
  if (p >= 10) return { hue: "#22b8ff", tag: "slight chance" };
  if (p >= 5) return { hue: "#3a9fd0", tag: "unlikely" };
  return { hue: "#6b7280", tag: "dry" };
}

/** Curve stroke color (temp = hot magenta, precip = cyan). */
export const CURVE_STROKE = {
  temp: "#ff00ff",
  precip: "#00d4ff",
} as const;
