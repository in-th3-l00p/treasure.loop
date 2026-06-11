"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { CheckIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

type RsvpStatus = "going" | "interested"

interface RsvpState {
  signedIn: boolean
  status: RsvpStatus | null
  going: number
}

/**
 * Subtle RSVP toggle for the public event page. On mount it GETs the
 * caller's current state from `/api/play/rsvp`. Signed-in visitors get
 * an "I'm going" / "Going ✓" toggle; anonymous visitors are routed to
 * `/play` to connect a wallet first. The primary CTA stays "Play the
 * hunt" — this is a secondary, on-brand control.
 */
export function RsvpButton({
  slug,
  initialGoing,
}: {
  slug: string
  initialGoing: number
}) {
  const router = useRouter()
  const [state, setState] = useState<RsvpState>({
    signedIn: false,
    status: null,
    going: initialGoing,
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/play/rsvp?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: RsvpState | null) => {
        if (active && data) setState(data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  const going = state.status === "going"

  const toggle = useCallback(async () => {
    if (!state.signedIn) {
      router.push("/play")
      return
    }
    setBusy(true)
    try {
      if (going) {
        const res = await fetch("/api/play/rsvp", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug }),
        })
        if (res.ok) {
          const data = (await res.json()) as { going: number }
          setState((s) => ({ ...s, status: null, going: data.going }))
        }
      } else {
        const res = await fetch("/api/play/rsvp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, status: "going" }),
        })
        if (res.ok) {
          const data = (await res.json()) as {
            status: RsvpStatus
            going: number
          }
          setState((s) => ({ ...s, status: data.status, going: data.going }))
        }
      }
    } catch {
      // Network hiccup — leave the prior state; the user can retry.
    } finally {
      setBusy(false)
    }
  }, [going, router, slug, state.signedIn])

  const label = !state.signedIn
    ? "Connect wallet to RSVP"
    : going
      ? "Going"
      : "I'm going"

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || busy}
      aria-pressed={going}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:opacity-70",
        going
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-card/40 text-foreground hover:bg-card/70"
      )}
    >
      {busy || loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : going ? (
        <CheckIcon className="size-4" />
      ) : null}
      {label}
    </button>
  )
}
