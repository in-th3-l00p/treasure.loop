"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { CheckIcon, Loader2Icon, UserPlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface FollowState {
  isFollowing: boolean
  followers: number
  following: number
  signedIn: boolean
}

/**
 * Subtle follow toggle for a public profile (`/u/[handle]`). On mount it
 * GETs the caller's state from `/api/play/follow`. Signed-in visitors get
 * a "Follow" / "Following ✓" toggle; anonymous visitors are routed to
 * `/play` to connect a wallet first.
 *
 * The button hides itself when the viewer is looking at their own
 * profile — the server tells us the profile wallet via `profileWallet`,
 * and the GET response carries whether the signed-in viewer matches it.
 */
export function FollowButton({
  handle,
  isOwnProfile,
}: {
  handle: string
  /**
   * True when the server already resolved the viewer's session to this
   * profile's wallet. The button is suppressed for the owner; we keep the
   * decision server-side so we never flash a Follow control to yourself.
   */
  isOwnProfile: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<FollowState | null>(null)
  // Own-profile renders nothing, so it never needs to load state.
  const [loading, setLoading] = useState(!isOwnProfile)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isOwnProfile) return
    let active = true
    fetch(`/api/play/follow?handle=${encodeURIComponent(handle)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: FollowState | null) => {
        if (active && data) setState(data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [handle, isOwnProfile])

  const following = state?.isFollowing ?? false

  const toggle = useCallback(async () => {
    if (!state?.signedIn) {
      router.push("/play")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/play/follow", {
        method: following ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          isFollowing: boolean
          followers: number
        }
        setState((s) =>
          s
            ? {
                ...s,
                isFollowing: data.isFollowing,
                followers: data.followers,
              }
            : s
        )
      }
    } catch {
      // Network hiccup — keep the prior state; the user can retry.
    } finally {
      setBusy(false)
    }
  }, [following, handle, router, state?.signedIn])

  // The owner never sees a follow control for their own profile.
  if (isOwnProfile) return null

  const label = !state?.signedIn
    ? "Connect wallet to follow"
    : following
      ? "Following"
      : "Follow"

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || busy}
      aria-pressed={following}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:opacity-70",
        following
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-card/40 text-foreground hover:bg-card/70"
      )}
    >
      {busy || loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : following ? (
        <CheckIcon className="size-4" />
      ) : (
        <UserPlusIcon className="size-4" />
      )}
      {label}
    </button>
  )
}
