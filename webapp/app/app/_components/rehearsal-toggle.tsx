"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { setRehearsalMode } from "@/lib/event-actions"
import { cn } from "@/lib/utils"

/**
 * Organizer-only control to flip the active event in and out of
 * dress-rehearsal mode. In rehearsal, finisher badges are NOT minted on
 * chain — the mint-permit route refuses to sign a production permit.
 *
 * Render this only for organizers (the page gates it); the Server Action
 * re-checks the role and writes an audit row on every flip.
 */
export function RehearsalToggle({ rehearsal }: { rehearsal: boolean }) {
  const [on, setOn] = useState(rehearsal)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toggle = (next: boolean) => {
    setError(null)
    const prev = on
    setOn(next)
    startTransition(async () => {
      const result = await setRehearsalMode({ rehearsal: next })
      if (!result.ok) {
        setOn(prev)
        setError(result.message)
      }
    })
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-full border px-3 py-1.5 text-xs transition-colors",
        on
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground"
      )}
    >
      <span className="flex items-center gap-1.5">
        {pending && <Loader2Icon className="size-3 animate-spin" />}
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase">
          Rehearsal
        </span>
      </span>
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={toggle}
        aria-label="Dress-rehearsal mode"
      />
      {error && <span className="text-rose-300/90">{error}</span>}
    </div>
  )
}
