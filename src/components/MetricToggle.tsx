export type Metric = "temp" | "precip" | "wind";

interface MetricToggleProps {
  mode: Metric;
  onChange: (mode: Metric) => void;
}

const TABS: ReadonlyArray<{ mode: Metric; label: string; active: string }> = [
  {
    mode: "temp",
    label: "[ TEMP ]",
    active: "bg-accent-secondary/[0.12] text-accent-secondary [text-shadow:0_0_8px_#ff00ff80]",
  },
  {
    mode: "precip",
    label: "[ RAIN ]",
    active: "bg-accent-tertiary/[0.12] text-accent-tertiary [text-shadow:0_0_8px_#00d4ff80]",
  },
  {
    mode: "wind",
    label: "[ WIND ]",
    active: "bg-[#ffb020]/[0.12] text-[#ffb020] [text-shadow:0_0_8px_#ffb02080]",
  },
];

/** Temperature / rain / wind segmented toggle, styled as HUD mode tabs. */
export function MetricToggle({ mode, onChange }: MetricToggleProps) {
  const base =
    "flex-1 min-h-[44px] font-tech text-[13px] uppercase tracking-[0.2em] transition-[color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div
      className="cyber-chamfer-sm mx-3.5 mb-3 flex border border-border bg-card min-[700px]:mx-auto min-[700px]:max-w-[480px]"
      role="tablist"
      aria-label="Choose measurement"
    >
      {TABS.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={mode === tab.mode}
          onClick={() => onChange(tab.mode)}
          className={`${base} ${
            mode === tab.mode ? tab.active : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
