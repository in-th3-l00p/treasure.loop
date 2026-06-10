"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  UsersIcon,
} from "lucide-react"

import {
  useActiveFragment,
  useCombineFragments,
  useReportPairCheating,
} from "@/lib/play-hooks"

import { PlayCta } from "../_components/play-cta"

const REJECTION_COPY: Record<string, string> = {
  "unknown-code": "No fragment matches that code at this checkpoint.",
  "same-player": "That's your own code — find another player.",
  "not-complementary":
    "You both hold the same half. Find someone with the other letter.",
  "already-paired": "One of these fragments is already paired.",
  "no-fragment": "You don't have a fragment to pair yet.",
  "missing-code": "Enter the other player's code.",
  "checkpoint-offline": "That checkpoint is paused right now — try again shortly.",
  "rate-limited": "Too many tries. Wait a moment and try again.",
}

function rejectionCopy(e: unknown): string {
  const code = (e as Error & { code?: string }).code
  if (code && REJECTION_COPY[code]) return REJECTION_COPY[code]
  return e instanceof Error ? e.message : "Could not pair. Try again."
}

export default function PairPage() {
  const router = useRouter()
  const { data: fragment, isLoading } = useActiveFragment()
  const combine = useCombineFragments()
  const report = useReportPairCheating()
  const [code, setCode] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [reported, setReported] = useState(false)

  const complement = fragment?.kind === "A" ? "B" : "A"

  const submit = useCallback(async () => {
    if (!code.trim()) return
    setLocalError(null)
    try {
      const data = await combine.mutateAsync({ code: code.trim() })
      router.push(`/play/progress?solved=${data.checkpointId}`)
    } catch (e) {
      setLocalError(rejectionCopy(e))
    }
  }, [code, combine, router])

  const onReport = useCallback(async () => {
    try {
      await report.mutateAsync({ code: code.trim() || undefined })
      setReported(true)
    } catch {
      // best-effort; surface nothing if the flag write hiccups
      setReported(true)
    }
  }, [code, report])

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2Icon className="mr-2 size-4 animate-spin" />
        Loading your fragment…
      </main>
    )
  }

  if (!fragment) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="grid w-full max-w-sm gap-3 text-center">
          <h1 className="text-2xl font-medium tracking-tight">No fragment yet</h1>
          <p className="text-sm text-muted-foreground">
            Scan a pair checkpoint to receive a fragment, then come back here to
            combine it with another player.
          </p>
          <PlayCta href="/play/progress" className="mt-3">
            Back to progress
          </PlayCta>
        </div>
      </main>
    )
  }

  if (fragment.paired) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="grid w-full max-w-sm gap-3 text-center">
          <CheckCircle2Icon className="mx-auto size-10 text-emerald-400" />
          <h1 className="text-2xl font-medium tracking-tight">
            {fragment.checkpointName} solved
          </h1>
          <p className="text-sm text-muted-foreground">
            Your fragment is paired. This checkpoint is complete for both of you.
          </p>
          <PlayCta href="/play/progress" className="mt-3">
            Back to progress
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
          Pair checkpoint
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12">
        <div className="grid gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            {fragment.checkpointName}
          </p>
          <h1 className="text-[34px] leading-tight font-medium tracking-tight">
            Find your match
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You have fragment <span className="text-foreground">{fragment.kind}</span>.
            Find a player holding fragment{" "}
            <span className="text-foreground">{complement}</span>, then type their
            code below — or read yours to them.
          </p>
        </div>

        <div className="grid place-items-center gap-4 rounded-3xl border border-border bg-card/30 p-8">
          <UsersIcon className="size-8 text-primary/70" />
          <div className="grid gap-1 text-center">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              Your fragment
            </p>
            <p className="font-mono text-3xl tracking-[0.2em]">
              {fragment.kind} · {fragment.shortCode}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label
              htmlFor="pair-code"
              className="text-[11px] text-muted-foreground"
            >
              Other player&apos;s code (fragment {complement})
            </label>
            <input
              id="pair-code"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXX"
              maxLength={8}
              className="h-12 rounded-xl border border-border bg-card/30 px-3.5 text-center font-mono text-xl tracking-[0.25em] uppercase outline-none transition-colors focus-visible:border-primary/60 focus-visible:bg-card/50 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {localError && (
            <p role="alert" className="text-[11px] text-rose-300/90">
              {localError}
            </p>
          )}

          <PlayCta onClick={submit} disabled={combine.isPending || !code.trim()}>
            {combine.isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Pairing…
              </>
            ) : (
              "Combine fragments"
            )}
          </PlayCta>

          {reported ? (
            <p
              role="status"
              className="text-center text-[11px] text-muted-foreground"
            >
              Thanks — flagged for staff review.
            </p>
          ) : (
            <button
              type="button"
              onClick={onReport}
              disabled={report.isPending}
              className="text-center text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Report suspected cheating
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
