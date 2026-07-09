import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fmtHour } from "../lib/format";

export interface CurveBand {
  min: number[];
  max: number[];
}

interface HourlyCurveProps {
  values: number[];
  band?: CurveBand;
  mode: "temp" | "precip";
}

const W = 880;
const H = 230;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 36;

/**
 * Hand-built SVG curve, ported from the reference and generalized over both
 * value ranges via props. Cyberpunk skin: neon-glow strokes (drop-shadow),
 * a HUD-style grid, and a vertical hot→cold gradient on the temperature line.
 *
 * Interactive: hovering (or dragging on touch) reveals a crosshair + focus dot
 * at the nearest hour with a HUD tooltip showing the time and value.
 */
export function HourlyCurve({ values, band, mode }: HourlyCurveProps) {
  const isT = mode === "temp";
  const uid = useId().replace(/:/g, ""); // colons are invalid in SVG url() refs
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const min = isT ? 40 : 0;
  const dataMax = Math.max(...values, ...(band?.max ?? []));
  const max = isT ? 100 : dataMax > 30 ? 100 : 30;

  const strokeColor = isT ? "#ff00ff" : "#00d4ff";
  const glowColor = isT ? "#ff00ff" : "#00d4ff";
  const unit = isT ? "°" : "%";
  const gridVals = isT ? [50, 70, 90] : max === 30 ? [10, 20, 30] : [25, 50, 75, 100];

  const x = (h: number): number => PAD_L + (h / 23) * (W - PAD_L - PAD_R);
  const y = (v: number): number => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);

  // Map a pointer's client X to the nearest hour index (0–23).
  const hourFromPointer = (e: ReactPointerEvent<SVGSVGElement>): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const h = Math.round(((svgX - PAD_L) / (W - PAD_L - PAD_R)) * 23);
    return Math.max(0, Math.min(23, h));
  };

  const linePath = values
    .map((v, h) => `${h === 0 ? "M" : "L"}${x(h).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(23).toFixed(1)} ${H - PAD_B} L ${x(0).toFixed(1)} ${H - PAD_B} Z`;

  let bandPath: string | null = null;
  if (isT && band && band.min.length === 24 && band.max.length === 24) {
    const fwd = band.max.map((v, h) => `${h === 0 ? "M" : "L"}${x(h).toFixed(1)} ${y(v).toFixed(1)}`);
    const back = band.min.map((v, h) => `L ${x(h).toFixed(1)} ${y(v).toFixed(1)}`).reverse();
    bandPath = `${fwd.join(" ")} ${back.join(" ")} Z`;
  }

  const hiIdx = values.indexOf(Math.max(...values));
  const loIdx = values.indexOf(Math.min(...values));
  const glow = { filter: `drop-shadow(0 0 4px ${glowColor})` };

  // Hover readout geometry (percentages so it tracks the responsive SVG).
  const hv = hover !== null ? (values[hover] as number) : null;
  const tipLeft = hover !== null ? Math.max(9, Math.min(91, (x(hover) / W) * 100)) : 0;
  const tipTop = hv !== null ? (y(hv) / H) * 100 : 0;
  const bandLo = hover !== null && band?.min ? band.min[hover] : undefined;
  const bandHi = hover !== null && band?.max ? band.max[hover] : undefined;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Hourly ${isT ? "temperature" : "precipitation chance"} curve`}
        className="touch-pan-y"
        onPointerMove={(e) => setHover(hourFromPointer(e))}
        onPointerDown={(e) => setHover(hourFromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`stroke-${uid}`} x1="0" y1="0" x2="0" y2="1">
            {isT ? (
              <>
                <stop offset="0%" stopColor="#ff2d6f" />
                <stop offset="55%" stopColor="#ff00ff" />
                <stop offset="100%" stopColor="#00d4ff" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#008fbf" />
              </>
            )}
          </linearGradient>
          <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Daylight window (≈6:25 AM – 7:25 PM), tinted as an active data band. */}
        <rect
          x={x(6.4)}
          y={PAD_T}
          width={x(19.4) - x(6.4)}
          height={H - PAD_T - PAD_B}
          fill="#00ff88"
          opacity="0.04"
        />

        {/* HUD gridlines + axis labels. */}
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke="#2a2a3a"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text x="2" y={y(v) + 4} fontSize="11" fill="#6b7280" fontFamily="'Share Tech Mono', monospace">
              {v}
              {unit}
            </text>
          </g>
        ))}

        {/* Uncertainty band. */}
        {bandPath && <path d={bandPath} fill={strokeColor} opacity="0.12" />}

        {/* Filled area + glowing curve. */}
        <path d={areaPath} fill={`url(#fill-${uid})`} />
        <path
          d={linePath}
          fill="none"
          stroke={`url(#stroke-${uid})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={glow}
        />

        {/* Hover crosshair + focus dot. */}
        {hover !== null && hv !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hover)}
              y1={PAD_T}
              x2={x(hover)}
              y2={H - PAD_B}
              stroke={strokeColor}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.6"
            />
            <circle cx={x(hover)} cy={y(hv)} r="6" fill="none" stroke={strokeColor} strokeWidth="1.5" opacity="0.5" />
            <circle cx={x(hover)} cy={y(hv)} r="3.5" fill={strokeColor} style={glow} />
          </g>
        )}

        {/* Hi/Lo (temp) or peak (precip) markers. */}
        {isT ? (
          <>
            <circle cx={x(hiIdx)} cy={y(values[hiIdx] as number)} r="4.5" fill="#ff2d6f" style={{ filter: "drop-shadow(0 0 4px #ff2d6f)" }} />
            <text x={x(hiIdx)} y={y(values[hiIdx] as number) - 10} fontSize="12" fill="#ff6b9d" textAnchor="middle" fontWeight="700" fontFamily="'Share Tech Mono', monospace">
              {values[hiIdx]}°
            </text>
            <circle cx={x(loIdx)} cy={y(values[loIdx] as number)} r="4.5" fill="#00d4ff" style={{ filter: "drop-shadow(0 0 4px #00d4ff)" }} />
            <text x={x(loIdx)} y={y(values[loIdx] as number) - 10} fontSize="12" fill="#7fe3ff" textAnchor="middle" fontWeight="700" fontFamily="'Share Tech Mono', monospace">
              {values[loIdx]}°
            </text>
          </>
        ) : (
          (values[hiIdx] as number) > 0 && (
            <>
              <circle cx={x(hiIdx)} cy={y(values[hiIdx] as number)} r="4.5" fill="#00d4ff" style={{ filter: "drop-shadow(0 0 4px #00d4ff)" }} />
              <text x={x(hiIdx)} y={y(values[hiIdx] as number) - 10} fontSize="12" fill="#7fe3ff" textAnchor="middle" fontWeight="700" fontFamily="'Share Tech Mono', monospace">
                {values[hiIdx]}%
              </text>
            </>
          )
        )}

        {/* Sunrise / sunset markers. */}
        <text x={x(6.4) + 4} y={PAD_T + 12} fontSize="10" fill="#00ff88" fontFamily="'Share Tech Mono', monospace" opacity="0.7">
          ☀ 06:25
        </text>
        <text x={x(19.4) - 4} y={PAD_T + 12} fontSize="10" fill="#00ff88" fontFamily="'Share Tech Mono', monospace" textAnchor="end" opacity="0.7">
          19:25 ☾
        </text>

        {/* Hour ticks. */}
        {[0, 6, 12, 18, 23].map((h) => (
          <text key={h} x={x(h)} y={H - 10} fontSize="11" fill="#6b7280" textAnchor="middle" fontFamily="'Share Tech Mono', monospace">
            {fmtHour(h)}
          </text>
        ))}
      </svg>

      {/* HUD readout tooltip, tracking the hovered hour. */}
      {hover !== null && hv !== null && (
        <div
          className="cyber-chamfer-sm pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap border bg-background/95 px-2.5 py-1.5 text-center backdrop-blur-sm"
          style={{
            left: `${tipLeft}%`,
            top: `${tipTop}%`,
            borderColor: strokeColor,
            boxShadow: `0 0 6px ${strokeColor}90`,
          }}
          role="status"
        >
          <div className="font-tech text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {fmtHour(hover)}
          </div>
          <div
            className="font-display text-[15px] font-bold leading-none"
            style={{ color: strokeColor, textShadow: `0 0 6px ${strokeColor}80` }}
          >
            {hv}
            {isT ? "°F" : "%"}
          </div>
          {isT && bandLo !== undefined && bandHi !== undefined && bandHi > bandLo && (
            <div className="mt-0.5 font-tech text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              ↕ {bandLo}–{bandHi}°
            </div>
          )}
        </div>
      )}
    </div>
  );
}
