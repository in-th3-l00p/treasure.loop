"use client"

import Link from "next/link"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  TrophyIcon,
} from "lucide-react"

import { checkpoints } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default function ProgressPage() {
  const completedIdx = 1 // attendee finished CP-01, CP-02; currently between CP-02 and CP-03

  return (
    <main className="play-progress relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 size-[34rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.25),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          <ClockIcon className="size-3" />
          22 min elapsed
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12">
        <div className="grid gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Your loop
          </p>
          <div className="flex items-end justify-between gap-3">
            <h1 className="font-heading text-[36px] leading-tight font-medium tracking-tight">
              {completedIdx + 1} of {checkpoints.length} solved
            </h1>
            <span className="pb-1 text-sm font-medium tabular-nums text-primary">
              {Math.round(((completedIdx + 1) / checkpoints.length) * 100)}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-400"
              style={{
                width: `${((completedIdx + 1) / checkpoints.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <ol className="grid gap-3">
          {checkpoints.map((cp, i) => {
            const done = i <= completedIdx
            const current = i === completedIdx + 1
            return (
              <li
                key={cp.id}
                className={cn(
                  "grid grid-cols-[28px_1fr_auto] items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  done && "border-border bg-card/30",
                  current && "border-primary/40 bg-primary/8 shadow-[0_0_24px_-8px_oklch(73%_0.17_296_/_0.4)]",
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
                    {cp.sponsor} · {cp.area}
                  </p>
                  {current && (
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

        <div className="grid gap-2">
          <Link
            href="/play/scan"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px"
          >
            Continue to next checkpoint
          </Link>
          <Link
            href="/play/claim"
            className="text-center text-xs text-muted-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
          >
            Preview the badge claim screen
          </Link>
        </div>
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
