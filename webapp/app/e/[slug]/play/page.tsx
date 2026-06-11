"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"

/**
 * Enter an event's play surface. Marks the event as the session's active
 * event (so the play APIs scope to it), then hands off to the shared play
 * flow. Phase 1 will fold the full play UI under this route; for now it's
 * the multi-event entry point.
 */
export default function EnterEventPlay() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/play/event/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: params.slug }),
    })
      .then((r) => {
        if (cancelled) return
        if (r.ok) router.replace("/play")
        else setError(true)
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [params.slug, router])

  return (
    <main className="grid min-h-screen place-items-center px-5">
      {error ? (
        <div className="grid max-w-sm gap-2 text-center">
          <h1 className="text-xl font-medium tracking-tight">
            Event not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This event isn&apos;t available to play. It may be private or no
            longer listed.
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Entering the hunt…
        </p>
      )}
    </main>
  )
}
