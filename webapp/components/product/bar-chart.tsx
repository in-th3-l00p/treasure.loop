/**
 * Stacked hourly bar chart (pure markup, renders on the server).
 * `primary` is the emphasized series; `secondary` stacks on top in a
 * faint tint of the same hue.
 */
export function BarChart({
  data,
  max,
  height = 168,
  emptyLabel = "No traffic recorded yet.",
}: {
  data: { label: string; primary: number; secondary: number }[]
  max: number
  height?: number
  emptyLabel?: string
}) {
  if (data.length === 0 || max <= 0) {
    return (
      <div
        className="grid place-items-center border-b border-border text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    )
  }
  return (
    <div>
      <div
        className="relative grid gap-2"
        style={{ height, gridAutoFlow: "column", gridAutoColumns: "1fr" }}
      >
        {data.map((d) => {
          const total = d.primary + d.secondary
          const totalPct = Math.max((total / max) * 100, 2)
          const primaryPct = total > 0 ? (d.primary / total) * 100 : 0
          return (
            <div key={d.label} className="relative h-full">
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-[2px]"
                style={{ height: `${totalPct}%` }}
              >
                <div
                  className="w-full bg-primary/20"
                  style={{ height: `${100 - primaryPct}%` }}
                />
                <div
                  className="w-full bg-primary"
                  style={{ height: `${primaryPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="mt-2 grid gap-2 border-t border-border pt-2"
        style={{ gridAutoFlow: "column", gridAutoColumns: "1fr" }}
      >
        {data.map((d) => (
          <span
            key={d.label}
            className="text-center font-mono text-[10px] text-muted-foreground"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ChartLegend({
  items,
}: {
  items: { label: string; tone: "primary" | "faint" }[]
}) {
  return (
    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className={
              i.tone === "primary"
                ? "size-2 rounded-[2px] bg-primary"
                : "size-2 rounded-[2px] bg-primary/20"
            }
          />
          {i.label}
        </span>
      ))}
    </div>
  )
}
