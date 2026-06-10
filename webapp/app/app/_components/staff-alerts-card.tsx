"use client"

import { useState, useTransition } from "react"
import { LifeBuoyIcon } from "lucide-react"

import { acknowledgeStaffAlert } from "@/lib/booth-actions"
import type { OpenStaffAlert } from "@/lib/event-queries"
import { timeAgo } from "@/lib/format"

/**
 * Open booth "Help me" alerts, rendered inside the overview's "Needs
 * attention" column. Acknowledging an alert clears it from the list via
 * a Server Action (which sets status = acknowledged and revalidates).
 */
export function StaffAlertsList({ alerts }: { alerts: OpenStaffAlert[] }) {
  // Optimistically drop acknowledged ids so the row leaves immediately;
  // the server revalidation then makes it permanent.
  const [cleared, setCleared] = useState<Set<string>>(() => new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = alerts.filter((a) => !cleared.has(a.id))
  if (visible.length === 0) return null

  const acknowledge = (id: string) => {
    setPendingId(id)
    startTransition(async () => {
      const res = await acknowledgeStaffAlert({ alertId: id })
      if (res.ok) {
        setCleared((prev) => new Set(prev).add(id))
      }
      setPendingId(null)
    })
  }

  return (
    <ul className="grid divide-y divide-border">
      {visible.map((alert) => (
        <li
          key={alert.id}
          className="flex items-center justify-between gap-3 py-3"
        >
          <div className="flex items-start gap-3">
            <LifeBuoyIcon className="mt-0.5 size-4 shrink-0 text-amber-400/90" />
            <div className="min-w-0">
              <p className="text-sm">
                {alert.checkpointName} needs help
              </p>
              <p className="text-xs text-muted-foreground">
                {alert.message ?? alert.area ?? "Booth staff requested help"} ·{" "}
                {timeAgo(alert.createdAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => acknowledge(alert.id)}
            disabled={pendingId === alert.id}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {pendingId === alert.id ? "…" : "Acknowledge"}
          </button>
        </li>
      ))}
    </ul>
  )
}
