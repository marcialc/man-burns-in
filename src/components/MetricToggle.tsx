export type Metric = "temp" | "precip";

interface MetricToggleProps {
  mode: Metric;
  onChange: (mode: Metric) => void;
}

/** Temperature / Precipitation segmented toggle, styled as HUD mode tabs. */
export function MetricToggle({ mode, onChange }: MetricToggleProps) {
  const base =
    "flex-1 min-h-[44px] font-tech text-[13px] uppercase tracking-[0.2em] transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div
      className="cyber-chamfer-sm mx-3.5 mb-3 flex border border-border bg-card min-[700px]:mx-auto min-[700px]:max-w-[420px]"
      role="tablist"
      aria-label="Choose measurement"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "temp"}
        onClick={() => onChange("temp")}
        className={`${base} ${
          mode === "temp"
            ? "bg-accent-secondary/[0.12] text-accent-secondary [text-shadow:0_0_8px_#ff00ff80]"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        [ TEMP ]
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "precip"}
        onClick={() => onChange("precip")}
        className={`${base} ${
          mode === "precip"
            ? "bg-accent-tertiary/[0.12] text-accent-tertiary [text-shadow:0_0_8px_#00d4ff80]"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        [ PRECIP ]
      </button>
    </div>
  );
}
