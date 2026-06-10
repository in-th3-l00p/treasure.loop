import { cn } from "@/lib/utils"

/**
 * Checkpoint status vocabulary, in one place. Pages render the same
 * dot + label everywhere so operators learn the colors once.
 */
export type CheckpointStatusValue =
  | "healthy"
  | "busy"
  | "needs_staff"
  | "offline"

export const checkpointStatusMeta: Record<
  CheckpointStatusValue,
  { label: string; text: string }
> = {
  healthy: { label: "Healthy", text: "text-emerald-400/90" },
  busy: { label: "Busy", text: "text-amber-400/90" },
  needs_staff: { label: "Needs staff", text: "text-rose-400/90" },
  offline: { label: "Offline", text: "text-muted-foreground" },
}

export function CheckpointStatus({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const meta =
    checkpointStatusMeta[status as CheckpointStatusValue] ??
    checkpointStatusMeta.offline
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs",
        meta.text,
        className
      )}
    >
      <span className="status-dot" />
      {meta.label}
    </span>
  )
}

/** Event lifecycle status → operator-facing label. */
export const eventStatusLabel: Record<string, string> = {
  draft: "Draft",
  live_rehearsal: "Live rehearsal",
  live: "Live",
  ended: "Ended",
}
