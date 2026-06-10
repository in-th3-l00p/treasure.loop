"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIcon,
  CircleDotIcon,
  DownloadIcon,
  PauseIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Kpi } from "@/components/product/kpi"
import { SectionHeading } from "@/components/product/section"
import { Switch } from "@/components/ui/switch"
import type { BadgePauseState } from "@/lib/badge-pause"
import { timeAgo } from "@/lib/format"
import type { LiveOpsSnapshot } from "@/lib/live-ops"
import { cn } from "@/lib/utils"

import { pollLiveOps, requestPauseToggle } from "../_actions"

const POLL_MS = 5_000

export interface LiveInitial {
  snapshot: LiveOpsSnapshot
  pause: BadgePauseState
}

/**
 * Live dashboard surface. Server-rendered with a first snapshot, then
 * polls `pollLiveOps` every ~5s. Polling pauses while the tab is hidden
 * so a forgotten tab doesn't hammer the server.
 */
export function LiveDashboard({ initial }: { initial: LiveInitial }) {
  const [snapshot, setSnapshot] = useState(initial.snapshot)
  const [pause, setPause] = useState(initial.pause)
  const [polledAt, setPolledAt] = useState<Date>(() => new Date())
  const [live, setLive] = useState(true)
  const [pauseNote, setPauseNote] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    const res = await pollLiveOps()
    if (res.ok) {
      setSnapshot(res.snapshot)
      setPause(res.pause)
      setPolledAt(new Date(res.polledAt))
    }
  }, [])

  useEffect(() => {
    function start() {
      if (timer.current) return
      timer.current = setInterval(poll, POLL_MS)
      setLive(true)
    }
    function stop() {
      if (timer.current) {
        clearInterval(timer.current)
        timer.current = null
      }
      setLive(false)
    }
    function onVisibility() {
      if (document.hidden) stop()
      else {
        void poll()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [poll])

  const onToggleAttempt = useCallback(async () => {
    const res = await requestPauseToggle()
    if (res.ok) {
      setPause(res.pause)
      setPauseNote(null)
    } else {
      setPauseNote(res.message)
    }
  }, [])

  const { scansPerMinute, rejectRate, queueDepths, activity, playersStarted } =
    snapshot
  const maxScans = Math.max(...scansPerMinute.map((b) => b.scans), 0)
  const totalRecentScans = scansPerMinute.reduce((a, b) => a + b.scans, 0)
  const hasScanTrend = totalRecentScans > 0

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={cn(
            "flex items-center gap-2 text-xs",
            live ? "text-emerald-400/90" : "text-muted-foreground"
          )}
        >
          <CircleDotIcon
            className={cn(
              "size-3.5",
              live ? "text-emerald-400/90" : "text-muted-foreground"
            )}
          />
          {live ? "Live — refreshing every 5s" : "Paused (tab hidden)"}
          <span className="text-muted-foreground/60">
            · updated {timeAgo(polledAt)}
          </span>
        </span>
        <div className="flex items-center gap-2">
          <a
            href="/api/app/event-report"
            download
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-xs text-muted-foreground hover:text-foreground"
            )}
          >
            <DownloadIcon className="mr-1.5 size-3" />
            Generate report
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void poll()}
          >
            <RefreshCwIcon className="mr-1.5 size-3" />
            Refresh now
          </Button>
        </div>
      </div>

      {/* Funnel depths */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Players started"
          value={playersStarted.toLocaleString()}
          context="Have a player record"
        />
        <Kpi
          label="In progress"
          value={queueDepths.inProgress.toLocaleString()}
          context="Scanned, not yet minted"
        />
        <Kpi
          label="Minted · unredeemed"
          value={queueDepths.mintedNotRedeemed.toLocaleString()}
          context="Finished, prize desk pending"
        />
        <Kpi
          label="Redeemed"
          value={queueDepths.redeemed.toLocaleString()}
          context="Collected a reward"
        />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        {/* Scans per minute */}
        <div>
          <SectionHeading
            title="Scans per minute"
            hint={`Last ${scansPerMinute.length} minutes · ${totalRecentScans} scans`}
          />
          {hasScanTrend ? (
            <ScanTrend buckets={scansPerMinute} max={maxScans} />
          ) : (
            <div className="grid h-[140px] place-items-center border-b border-border text-xs text-muted-foreground">
              No scans in the last {scansPerMinute.length} minutes.
            </div>
          )}
        </div>

        {/* Reject rate */}
        <div>
          <SectionHeading
            title="Reject rate"
            hint={`Scans rejected vs accepted, last ${rejectRate.windowMinutes} min`}
          />
          {rejectRate.accepted + rejectRate.rejected === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No scans recorded in this window.
            </p>
          ) : (
            <div className="grid gap-4 pt-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-medium tabular-nums tracking-tight",
                    rejectRate.rate >= 25
                      ? "text-rose-300"
                      : rejectRate.rate >= 10
                        ? "text-amber-300"
                        : "text-foreground"
                  )}
                >
                  {rejectRate.rate}%
                </span>
                <span className="text-xs text-muted-foreground">
                  rejected
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Accepted</dt>
                  <dd className="mt-0.5 font-mono tabular-nums">
                    {rejectRate.accepted}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Rejected</dt>
                  <dd className="mt-0.5 font-mono tabular-nums">
                    {rejectRate.rejected}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* Pause control + activity tail */}
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <SectionHeading
            title="Minting"
            hint="On-chain badge contract pause state"
          />
          <PauseControl
            pause={pause}
            note={pauseNote}
            onAttempt={onToggleAttempt}
          />
        </div>

        <div>
          <SectionHeading
            title="Recent activity"
            hint={
              activity.length === 0
                ? "No activity yet"
                : "Newest first, includes rejected scans"
            }
            trailing={
              <ActivityIcon className="size-3.5 text-muted-foreground" />
            }
          />
          {activity.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nothing has happened yet. Scans, mints, and redemptions stream
              in here as players move.
            </p>
          ) : (
            <ul className="grid divide-y divide-border">
              {activity.map((row) => (
                <li key={row.id} className="grid gap-0.5 py-2.5">
                  <p className="text-sm leading-snug">{row.line}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(new Date(row.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ScanTrend({
  buckets,
  max,
}: {
  buckets: { minute: string; scans: number }[]
  max: number
}) {
  const first = buckets[0]?.minute
  const last = buckets[buckets.length - 1]?.minute
  return (
    <div>
      <div
        className="relative grid h-[140px] items-end gap-px"
        style={{ gridAutoFlow: "column", gridAutoColumns: "1fr" }}
      >
        {buckets.map((b, i) => {
          const pct = max > 0 ? Math.max((b.scans / max) * 100, b.scans > 0 ? 6 : 0) : 0
          return (
            <div
              key={`${b.minute}-${i}`}
              className="group relative h-full"
              title={`${b.minute} · ${b.scans} scan${b.scans === 1 ? "" : "s"}`}
            >
              <div
                className="absolute inset-x-0 bottom-0 rounded-[1px] bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${pct}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  )
}

function PauseControl({
  pause,
  note,
  onAttempt,
}: {
  pause: BadgePauseState
  note: string | null
  onAttempt: () => void
}) {
  const paused = pause.paused === true
  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <PauseIcon
            className={cn(
              "size-4",
              !pause.configured
                ? "text-muted-foreground"
                : paused
                  ? "text-amber-300"
                  : "text-emerald-400/90"
            )}
          />
          <div>
            <p className="text-sm font-medium">
              {!pause.configured
                ? "Not configured"
                : pause.paused === null
                  ? "Unknown"
                  : paused
                    ? "Minting paused"
                    : "Minting open"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pause.configured ? "Read from the contract" : "No contract"}
            </p>
          </div>
        </div>
        <Switch
          checked={paused}
          disabled={!pause.canToggle}
          onCheckedChange={() => onAttempt()}
          aria-label="Pause minting"
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {pause.detail}
      </p>
      {note && (
        <p className="rounded-md border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {note}
        </p>
      )}
    </div>
  )
}
