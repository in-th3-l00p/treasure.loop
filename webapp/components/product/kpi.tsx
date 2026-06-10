import { Progress } from "@/components/ui/progress"

/**
 * One cell in the overview pulse strip. Quiet by design: mono label,
 * tabular number, one line of real context. No decorative deltas.
 */
export function Kpi({
  label,
  value,
  context,
  progress,
}: {
  label: string
  value: string
  context?: string
  progress?: number
}) {
  return (
    <div className="flex flex-col gap-2 bg-background p-4 transition-colors hover:bg-muted/30">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-2xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      {progress !== undefined && (
        <Progress value={progress} className="h-[2px]" />
      )}
      {context && <p className="text-xs text-muted-foreground">{context}</p>}
    </div>
  )
}

/** Definition-list metric for side panels. */
export function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums tracking-tight">
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
