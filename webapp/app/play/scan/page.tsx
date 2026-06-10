"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  ScanLineIcon,
} from "lucide-react"

import { usePlayEvent, useProgress, useRecordScan } from "@/lib/play-hooks"
import { cn } from "@/lib/utils"

import { PlayCta } from "../_components/play-cta"

export default function ScanPage() {
  const router = useRouter()
  const { data: progress, isLoading, error } = useProgress()
  const { data: playEvent, isLoading: loadingEvent } = usePlayEvent()
  const scan = useRecordScan()
  const [code, setCode] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const scanned = useMemo(() => new Set(progress?.scanned ?? []), [progress])
  const checkpoints = playEvent?.checkpoints ?? []
  const next = checkpoints.find((cp) => !scanned.has(cp.id))
  const stepNumber = next
    ? checkpoints.findIndex((cp) => cp.id === next.id) + 1
    : null

  const submit = useCallback(async () => {
    if (!next || !code.trim()) return
    setLocalError(null)
    try {
      const data = await scan.mutateAsync({
        checkpointId: next.id,
        code: code.trim(),
      })
      setSuccess(true)
      setTimeout(() => {
        if (data.progress.finished) {
          router.push("/play/claim")
        } else {
          router.push("/play/progress")
        }
      }, 800)
    } catch (e) {
      const status = (e as Error & { status?: number }).status
      setLocalError(
        status === 401
          ? "Sign in with your wallet first."
          : e instanceof Error
            ? e.message
            : "Could not record scan."
      )
    }
  }, [next, code, scan, router])

  if (isLoading || loadingEvent) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Loading checkpoint…
      </main>
    )
  }

  const errStatus = (error as (Error & { status?: number }) | null)?.status
  if (error) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="grid w-full max-w-sm gap-3 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            {errStatus === 401 ? "Sign in first" : "Something went wrong"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {errStatus === 401
              ? "Connect and sign in with your wallet before scanning."
              : error instanceof Error
                ? error.message
                : "Try again."}
          </p>
          <PlayCta href="/play" className="mt-3">
            Back to start
          </PlayCta>
        </div>
      </main>
    )
  }

  if (!next) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="grid w-full max-w-sm gap-3 text-center">
          <h1 className="text-2xl font-medium tracking-tight">
            You closed the loop.
          </h1>
          <p className="text-sm text-muted-foreground">
            Nothing left to scan. Mint your finisher badge to unlock the prize
            desk.
          </p>
          <PlayCta href="/play/claim" className="mt-3">
            Mint badge
          </PlayCta>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.25),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play/progress"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Progress
        </Link>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Step {stepNumber} of {checkpoints.length}
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12">
        <div className="grid gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Next checkpoint
          </p>
          <h1 className="text-[34px] leading-tight font-medium tracking-tight">
            {next.name}
          </h1>
          {next.clue && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {next.clue}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70">
            {[
              next.sponsor ? `Operated by ${next.sponsor}` : null,
              next.area,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div
          className={cn(
            "relative grid place-items-center rounded-3xl border bg-card/30 p-8 transition-colors",
            success ? "border-emerald-400/50" : "border-border"
          )}
        >
          <div className="absolute inset-x-8 top-8 grid grid-cols-2 justify-between">
            <span className="size-6 border-t border-l border-primary/50" />
            <span className="size-6 justify-self-end border-t border-r border-primary/50" />
          </div>
          <div className="absolute inset-x-8 bottom-8 grid grid-cols-2 justify-between">
            <span className="size-6 border-b border-l border-primary/50" />
            <span className="size-6 justify-self-end border-b border-r border-primary/50" />
          </div>
          <div className="relative grid size-32 place-items-center">
            {success ? (
              <CheckCircle2Icon className="size-12 text-emerald-400" />
            ) : (
              <ScanLineIcon className="size-12 text-primary/70" />
            )}
            {!success && (
              <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            )}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {success
              ? "Checkpoint solved."
              : "Ask the booth staff for the rotating 6-digit code on their screen, or tap the booth's NFC tag."}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label
              htmlFor="checkpoint-code"
              className="text-[11px] text-muted-foreground"
            >
              Verification code
            </label>
            <input
              id="checkpoint-code"
              autoComplete="one-time-code"
              spellCheck={false}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000 000"
              className="h-12 rounded-xl border border-border bg-card/30 px-3.5 text-center font-mono text-xl tracking-[0.2em] outline-none transition-colors focus:border-primary/50 focus:bg-card/50"
            />
          </div>

          {localError && (
            <p className="text-[11px] text-rose-300/90">{localError}</p>
          )}

          <PlayCta
            onClick={submit}
            disabled={scan.isPending || !code.trim()}
          >
            {scan.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Confirm scan"
            )}
          </PlayCta>
        </div>
      </div>
    </main>
  )
}
