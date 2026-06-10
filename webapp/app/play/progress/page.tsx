"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  Loader2Icon,
  TrophyIcon,
} from "lucide-react"

import { usePlayEvent, useProgress } from "@/lib/play-hooks"
import { cn } from "@/lib/utils"

import { PlayCta } from "../_components/play-cta"

export default function ProgressPage() {
  const { data: progress, isLoading, error, refetch } = useProgress()
  const { data: playEvent, isLoading: loadingEvent } = usePlayEvent()

  // Update "minutes elapsed" once a minute so we don't call Date.now()
  // during render. Initial value via lazy initializer to keep the
  // effect body free of setState.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const checkpoints = playEvent?.checkpoints ?? []
  const scanned = new Set(progress?.scanned ?? [])
  const completedCount = progress?.scanned.length ?? 0
  const total = progress?.total ?? checkpoints.length
  const finished = progress?.finished ?? false
  const minutesElapsed = progress?.startedAt
    ? Math.max(1, Math.round((now - progress.startedAt) / 60_000))
    : null
  const currentIndex = (() => {
    if (!progress) return 0
    if (finished) return total
    return checkpoints.findIndex((cp) => !scanned.has(cp.id))
  })()

  const errStatus = (error as (Error & { status?: number }) | null)?.status
  const errMessage =
    errStatus === 401
      ? "Sign in with your wallet to see your progress."
      : error instanceof Error
        ? error.message
        : null

  const busy = isLoading || loadingEvent

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 size-[34rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
        {minutesElapsed !== null && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            <ClockIcon className="size-3" />
            {minutesElapsed} min elapsed
          </span>
        )}
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12">
        <div className="grid gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Your loop
          </p>
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-[34px] leading-tight font-medium tracking-tight">
              {completedCount} of {total} solved
            </h1>
            <span className="pb-1 text-sm font-medium tabular-nums text-primary">
              {total > 0 ? Math.round((completedCount / total) * 100) : 0}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${total > 0 ? (completedCount / total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {busy && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading progress…
          </div>
        )}

        {errMessage && !busy && (
          <div className="grid gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <p>{errMessage}</p>
            <Link
              href="/play"
              className="text-xs text-rose-200/80 underline-offset-4 hover:underline"
            >
              Go back and sign in →
            </Link>
          </div>
        )}

        {!busy && !errMessage && (
          <ol className="grid gap-3">
            {checkpoints.map((cp, i) => {
              const done = scanned.has(cp.id)
              const current = !done && i === currentIndex
              return (
                <li
                  key={cp.id}
                  className={cn(
                    "grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl border p-3.5 transition-colors",
                    done && "border-border bg-card/30",
                    current && "border-primary/40 bg-primary/8",
                    !done && !current && "border-border/40 bg-transparent"
                  )}
                >
                  <span className="mt-0.5 grid size-7 place-items-center">
                    {done ? (
                      <CheckCircle2Icon className="size-5 text-emerald-400" />
                    ) : current ? (
                      <span className="grid size-6 place-items-center rounded-full border border-primary/60 bg-primary/15">
                        <span className="size-2 rounded-full bg-primary" />
                      </span>
                    ) : (
                      <CircleIcon className="size-5 text-muted-foreground/40" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        !done && !current && "text-muted-foreground"
                      )}
                    >
                      {cp.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[cp.sponsor, cp.area].filter(Boolean).join(" · ")}
                    </p>
                    {current && cp.clue && (
                      <p className="mt-2 text-xs leading-relaxed text-primary/80">
                        {cp.clue}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                    {done ? "Done" : current ? "Now" : `0${i + 1}`}
                  </span>
                </li>
              )
            })}
          </ol>
        )}

        {!busy && !errMessage && progress && (
          <div className="grid gap-2">
            {finished ? (
              <PlayCta href="/play/claim">Mint your finisher badge</PlayCta>
            ) : (
              <PlayCta href="/play/scan">Continue to next checkpoint</PlayCta>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="py-2 text-center text-xs text-muted-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
            >
              Refresh progress
            </button>
          </div>
        )}
      </div>

      <footer className="relative mx-auto flex w-full max-w-md items-center gap-3 px-5 pb-6">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card/40 text-amber-300">
          <TrophyIcon className="size-4" />
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Closing the loop unlocks the prize desk and mints your on-chain
          finisher badge.
        </p>
      </footer>
    </main>
  )
}
