interface SummaryProps {
  text: string;
}

/** Optional AI-written outlook, rendered as a terminal window. */
export function Summary({ text }: SummaryProps) {
  return (
    <div className="cyber-chamfer mb-5 border border-border bg-background">
      {/* Terminal chrome: traffic-light dots + title. */}
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffb020]" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="ml-2 font-tech text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          playa_outlook.log
        </span>
      </div>
      <p className="px-4 py-3.5 font-mono text-[13px] leading-relaxed text-foreground/90">
        <span className="mr-1.5 text-accent">$</span>
        {text}
        <span className="cyber-cursor" />
      </p>
    </div>
  );
}
