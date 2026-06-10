"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { currentCode, secondsUntilNext } from "@/lib/checkpoint-codes"
import { rotateCheckpointSecret } from "@/lib/event-actions"

/**
 * The kiosk screen. Runs on a tablet propped at the booth, read by
 * players from a step away — so the six digits are the whole show:
 * maximum size, maximum contrast, nothing decorative competing.
 *
 * The TOTP code is computed client-side from the shared secret so we
 * don't round-trip to the server every second. Middleware has already
 * verified the viewer is booth staff for this checkpoint.
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
      !window.confirm(
        "Rotate this checkpoint's secret? All previous codes become invalid immediately."
      )
    ) {
      return
    }
    startTransition(async () => {
      await rotateCheckpointSecret({ checkpointId })
      // Server revalidates; the reload picks up the new secret.
      window.location.reload()
    })
  }, [checkpointId])

  // Split the 6 digits into 3+3 for legibility from across a booth.
  const front = code.slice(0, 3)
  const back = code.slice(3)
  const pct = (remaining / 30) * 100

  return (
    <div className="grid gap-8 rounded-2xl border border-border bg-card/40 px-8 py-12">
      <div className="grid place-items-center gap-6">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          Show this code to the player
        </p>
        <div className="grid grid-flow-col items-center gap-4 text-[clamp(5rem,16vw,9rem)] font-medium tabular-nums leading-none tracking-tight">
          <span>{front}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{back}</span>
        </div>
        <div className="grid w-full max-w-md gap-1.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60"
            role="progressbar"
            aria-valuenow={remaining}
            aria-valuemin={0}
            aria-valuemax={30}
            aria-label="Seconds until the code rotates"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-center font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
            Rotates in {remaining}s
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          Codes stay valid for ±30 seconds of clock drift.
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
