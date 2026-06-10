"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  CirclePauseIcon,
  CirclePlayIcon,
  LifeBuoyIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  listRecentScans,
  raiseStaffAlert,
  setCheckpointPaused,
  type RecentScan,
} from "@/lib/booth-actions"
import { currentCode, secondsUntilNext } from "@/lib/checkpoint-codes"
import { rotateCheckpointSecret } from "@/lib/event-actions"
import { timeAgo } from "@/lib/format"

const RECENT_POLL_MS = 9_000

/**
 * The kiosk screen. Runs on a tablet propped at the booth, read by
 * players from a step away — so the six digits are the whole show:
 * maximum size, maximum contrast, nothing decorative competing.
 *
 * Below the code, booth staff get their operational controls: the last
 * five scans (polled, no fake data), a "Help me" alert button that
 * surfaces in the operator overview, and a Pause toggle that takes the
 * checkpoint offline so attendees can't scan it.
 *
 * The TOTP code is computed client-side from the shared secret so we
 * don't round-trip to the server every second. Middleware has already
 * verified the viewer is booth staff for this checkpoint.
 */
export function KioskScreen({
  checkpointId,
  checkpointName,
  secret,
  paused: initialPaused,
}: {
  checkpointId: string
  checkpointName: string
  secret: string
  paused: boolean
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
    <div className="grid gap-6">
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

      <BoothControls
        checkpointId={checkpointId}
        initialPaused={initialPaused}
      />
    </div>
  )
}

/**
 * The operational strip under the code: recent scans, "Help me", and the
 * Pause/Resume toggle. Kept in its own component so its polling state
 * doesn't re-render the 250 ms countdown above it.
 */
function BoothControls({
  checkpointId,
  initialPaused,
}: {
  checkpointId: string
  initialPaused: boolean
}) {
  const [paused, setPaused] = useState(initialPaused)
  const [recent, setRecent] = useState<RecentScan[] | null>(null)
  const [helpRaised, setHelpRaised] = useState(false)
  const [pausePending, startPause] = useTransition()
  const [helpPending, startHelp] = useTransition()
  const helpResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Poll recent scans. Simple interval, no SSE — the booth tablet is on
  // wifi and a 9 s cadence is plenty for a "who just scanned" glance.
  useEffect(() => {
    let active = true
    const load = async () => {
      const res = await listRecentScans({ checkpointId, limit: 5 })
      if (active && res.ok) setRecent(res.data ?? [])
    }
    load()
    const id = setInterval(load, RECENT_POLL_MS)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [checkpointId])

  useEffect(() => {
    return () => {
      if (helpResetRef.current) clearTimeout(helpResetRef.current)
    }
  }, [])

  const togglePause = useCallback(() => {
    const next = !paused
    startPause(async () => {
      const res = await setCheckpointPaused({ checkpointId, paused: next })
      if (res.ok) setPaused(next)
    })
  }, [checkpointId, paused])

  const callForHelp = useCallback(() => {
    startHelp(async () => {
      const res = await raiseStaffAlert({ checkpointId })
      if (res.ok) {
        setHelpRaised(true)
        if (helpResetRef.current) clearTimeout(helpResetRef.current)
        helpResetRef.current = setTimeout(() => setHelpRaised(false), 8_000)
      }
    })
  }, [checkpointId])

  return (
    <div className="grid gap-4">
      {paused && (
        <div
          className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-200"
          role="status"
        >
          This checkpoint is paused. Attendees can&apos;t scan it until you
          resume.
        </div>
      )}

      <div className="grid gap-4 rounded-2xl border border-border bg-card/40 p-5 sm:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Recent scans
          </p>
          {recent === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scans here yet. They&apos;ll appear as players check in.
            </p>
          ) : (
            <ul className="grid divide-y divide-border">
              {recent.map((scan) => (
                <li
                  key={scan.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="font-mono text-sm">{scan.shortWallet}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(scan.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-2 sm:border-l sm:border-border sm:pl-5">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={callForHelp}
            disabled={helpPending || helpRaised}
          >
            <LifeBuoyIcon className="mr-2 size-4" />
            {helpRaised
              ? "Help requested"
              : helpPending
                ? "Sending…"
                : "Help me"}
          </Button>
          <Button
            variant={paused ? "default" : "outline"}
            size="sm"
            className="justify-start"
            onClick={togglePause}
            disabled={pausePending}
          >
            {paused ? (
              <CirclePlayIcon className="mr-2 size-4" />
            ) : (
              <CirclePauseIcon className="mr-2 size-4" />
            )}
            {pausePending
              ? "Saving…"
              : paused
                ? "Resume checkpoint"
                : "Pause checkpoint"}
          </Button>
        </div>
      </div>
    </div>
  )
}
