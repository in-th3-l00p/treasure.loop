"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  ScanLineIcon,
} from "lucide-react"

import { usePlayEvent, useProgress, useRecordScan } from "@/lib/play-hooks"
import { cn } from "@/lib/utils"

import { PlayCta } from "../_components/play-cta"

function ScanPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCheckpointId = searchParams.get("cp")
  const urlToken = searchParams.get("t")
  const { data: progress, isLoading, error } = useProgress()
  const { data: playEvent, isLoading: loadingEvent } = usePlayEvent()
  const scan = useRecordScan()
  const [code, setCode] = useState("")
  const [shareLead, setShareLead] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // Guard so a signed URL only auto-submits once per page load.
  const tokenSubmitted = useRef(false)

  const scanned = useMemo(() => new Set(progress?.scanned ?? []), [progress])
  const checkpoints = playEvent?.checkpoints ?? []
  const next = checkpoints.find((cp) => !scanned.has(cp.id))
  const stepNumber = next
    ? checkpoints.findIndex((cp) => cp.id === next.id) + 1
    : null

  const finishScan = useCallback(
    (finished: boolean) => {
      setSuccess(true)
      setTimeout(() => {
        router.push(finished ? "/play/claim" : "/play/progress")
      }, 800)
    },
    [router]
  )

  const onScanError = useCallback((e: unknown) => {
    const status = (e as Error & { status?: number }).status
    setLocalError(
      status === 401
        ? "This scan link expired or you're not signed in. Ask staff for the code."
        : e instanceof Error
          ? e.message
          : "Could not record scan."
    )
  }, [])

  const submit = useCallback(async () => {
    if (!next || !code.trim()) return
    setLocalError(null)
    try {
      const data = await scan.mutateAsync({
        checkpointId: next.id,
        code: code.trim(),
        // Only meaningful at a sponsor booth; harmless otherwise.
        shareLead: Boolean(next.sponsor) && shareLead,
      })
      // A pair checkpoint hands back a fragment instead of progress —
      // send the player to the combine screen.
      if (data.fragment) {
        router.push("/play/pair")
        return
      }
      finishScan(Boolean(data.progress?.finished))
    } catch (e) {
      onScanError(e)
    }
  }, [next, code, shareLead, scan, finishScan, onScanError, router])

  // Tap-to-scan: a signed `?cp=&t=` URL submits the token automatically
  // for the matching unscanned checkpoint, skipping manual code entry.
  useEffect(() => {
    if (tokenSubmitted.current) return
    if (!urlCheckpointId || !urlToken) return
    // Only auto-submit once progress is loaded and the checkpoint is
    // still the one the player needs to scan next.
    if (!progress || !next) return
    if (next.id !== urlCheckpointId) return
    tokenSubmitted.current = true
    scan
      .mutateAsync({ checkpointId: urlCheckpointId, t: urlToken })
      .then((data) => {
        if (data.fragment) {
          router.push("/play/pair")
          return
        }
        finishScan(Boolean(data.progress?.finished))
      })
      .catch(onScanError)
  }, [urlCheckpointId, urlToken, progress, next, scan, finishScan, onScanError, router])

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
    <main className="relative min-h-screen overflow-hidden md:flex md:flex-col md:items-center md:justify-center md:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.25),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative w-full md:max-w-xl md:overflow-hidden md:rounded-[2rem] md:border md:border-border/60 md:bg-card/20 md:shadow-[0_40px_120px_-40px_oklch(56%_0.18_286_/_0.55)] md:backdrop-blur-sm">
      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6 md:max-w-none md:px-8 md:pt-8">
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

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12 md:max-w-none md:px-8 md:pb-10">
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
          <p className="text-xs text-muted-foreground">
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
          <p
            role="status"
            className="mt-6 text-center text-sm text-muted-foreground"
          >
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
              className="h-12 rounded-xl border border-border bg-card/30 px-3.5 text-center font-mono text-xl tracking-[0.2em] outline-none transition-colors focus-visible:border-primary/60 focus-visible:bg-card/50 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {localError && (
            <p role="alert" className="text-[11px] text-rose-300/90">
              {localError}
            </p>
          )}

          {next.sponsor && (
            <button
              type="button"
              role="switch"
              aria-checked={shareLead}
              onClick={() => setShareLead((v) => !v)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/20 px-3.5 py-3 text-left transition-colors hover:bg-card/40"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  shareLead ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "size-4 rounded-full bg-background transition-transform",
                    shareLead ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm">
                  Share my wallet with {next.sponsor}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  Optional. Lets this sponsor follow up with you. You can
                  scan without sharing.
                </span>
              </span>
            </button>
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
      </div>
    </main>
  )
}

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          <Loader2Icon className="mr-2 size-4 animate-spin" />
          Loading checkpoint…
        </main>
      }
    >
      <ScanPageInner />
    </Suspense>
  )
}
