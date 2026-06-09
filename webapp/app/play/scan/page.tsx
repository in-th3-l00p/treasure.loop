"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  QrCodeIcon,
  ScanLineIcon,
} from "lucide-react"

import { checkpoints } from "@/lib/mock-data"
import { useProgress, useRecordScan } from "@/lib/play-hooks"
import { cn } from "@/lib/utils"

export default function ScanPage() {
  const router = useRouter()
  const { data: progress, isLoading, error } = useProgress()
  const scan = useRecordScan()
  const [code, setCode] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const scanned = useMemo(
    () => new Set(progress?.scanned ?? []),
    [progress]
  )
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

  if (isLoading) {
    return (
      <main className="play-scan flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Loading checkpoint…
      </main>
    )
  }

  const errStatus = (error as Error & { status?: number } | null)?.status
  if (error) {
    return (
      <main className="play-scan grid min-h-screen place-items-center px-5">
        <div className="grid max-w-sm gap-3 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {errStatus === 401 ? "Sign in first" : "Something went wrong"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {errStatus === 401
              ? "Connect and sign in with your wallet before scanning."
              : error instanceof Error
                ? error.message
                : "Try again."}
          </p>
          <Link
            href="/play"
            className="mx-auto mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 px-5 text-sm font-medium text-primary-foreground"
          >
            Back to landing
          </Link>
        </div>
      </main>
    )
  }

  if (!next) {
    return (
      <main className="play-scan grid min-h-screen place-items-center px-5">
        <div className="grid max-w-sm gap-3 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            You closed the loop.
          </h1>
          <p className="text-sm text-muted-foreground">
            Nothing left to scan. Mint your finisher badge to unlock the
            prize desk.
          </p>
          <Link
            href="/play/claim"
            className="mx-auto mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 px-5 text-sm font-medium text-primary-foreground"
          >
            Mint badge
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="play-scan relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.3),transparent_60%)] blur-2xl" />
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
          <h1 className="font-heading text-[36px] leading-tight font-medium tracking-tight">
            {next.name}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {next.clue}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Operated by {next.sponsor} · {next.area}
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
              : "Hold your phone over the booth's NFC tag, or enter the code the staff gave you."}
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
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="HVT-9F4K"
              className="h-11 rounded-xl border border-border bg-card/30 px-3.5 font-mono text-base tracking-[0.08em] outline-none transition-colors focus:border-primary/50 focus:bg-card/50"
            />
          </div>

          {localError && (
            <p className="text-[11px] text-rose-300/90">{localError}</p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={scan.isPending || !code.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-px disabled:opacity-60"
          >
            {scan.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Confirm scan"
            )}
          </button>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card/40 text-sm font-medium text-foreground transition-colors hover:bg-card/60"
          >
            <QrCodeIcon className="size-4" />
            Scan a QR code instead
          </button>
        </div>
      </div>
    </main>
  )
}
