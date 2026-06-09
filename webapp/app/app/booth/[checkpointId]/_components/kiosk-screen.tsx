"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { currentCode, secondsUntilNext } from "@/lib/checkpoint-codes"
import { rotateCheckpointSecret } from "@/lib/event-actions"

/**
 * The kiosk screen.
 *
 * The TOTP code is computed client-side from the shared secret so we
 * don't need to round-trip to the server every second. The secret is
 * given to staff by the organizer (and the page won't render if the
 * staff isn't authorized — middleware enforces that).
 */
export function KioskScreen({
  checkpointId,
  checkpointName,
  secret,
}: {
  checkpointId: string
  checkpointName: string
  secret: string
}) {
  const [code, setCode] = useState<string>(() =>
    currentCode(secret, checkpointName)
  )
  const [remaining, setRemaining] = useState<number>(() => secondsUntilNext())
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const id = setInterval(() => {
      setCode(currentCode(secret, checkpointName))
      setRemaining(secondsUntilNext())
    }, 250)
    return () => clearInterval(id)
  }, [secret, checkpointName])

  const rotate = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Rotate this checkpoint's secret? All previous codes become invalid immediately."
      )
    ) {
      return
    }
    startTransition(async () => {
      await rotateCheckpointSecret({ checkpointId })
      // Server revalidates; the page reload picks up the new secret.
      if (typeof window !== "undefined") {
        window.location.reload()
      }
    })
  }, [checkpointId])

  // Split the 6 digits into 3+3 for legibility from across a booth.
  const front = code.slice(0, 3)
  const back = code.slice(3)
  const pct = (remaining / 30) * 100

  return (
    <div className="grid gap-6 rounded-3xl border border-border bg-gradient-to-br from-primary/10 to-fuchsia-400/5 p-8">
      <div className="grid place-items-center gap-4">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Show this code to the player
        </p>
        <div className="grid grid-flow-col items-center gap-3 text-7xl font-medium tabular-nums leading-none tracking-tight sm:text-8xl">
          <span>{front}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{back}</span>
        </div>
        <div className="grid w-full max-w-md gap-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Rotates in {remaining}s
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Code is valid for ±30 seconds of staff/player clock drift.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={rotate}
          disabled={pending}
        >
          <RefreshCwIcon className="mr-1.5 size-3" />
          {pending ? "Rotating…" : "Rotate secret"}
        </Button>
      </div>
    </div>
  )
}
