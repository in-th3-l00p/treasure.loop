"use client"

import { useState, useTransition } from "react"
import { CheckIcon, CopyIcon, Link2Icon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createShareLink, revokeShareLink } from "@/lib/share-actions"

/**
 * Create / revoke control for a sponsor's public share link. Calls the
 * Server Actions and reflects the current link. A live link shows its
 * URL + copy + revoke; no link shows a create button.
 */
export function ShareLinkControl({
  eventId,
  sponsorId,
  initialToken,
  baseUrl,
}: {
  eventId: string
  sponsorId: string
  initialToken: string | null
  baseUrl: string
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const url = token
    ? `${baseUrl}/share/${token}/sponsor/${sponsorId}`
    : null

  function create() {
    setError(null)
    startTransition(async () => {
      const res = await createShareLink({ eventId, sponsorId })
      if (res.ok) setToken(res.data?.token ?? null)
      else setError(res.message)
    })
  }

  function revoke() {
    setError(null)
    startTransition(async () => {
      const res = await revokeShareLink({ eventId, sponsorId })
      if (res.ok) {
        setToken(null)
        setCopied(false)
      } else setError(res.message)
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can fail without a secure context; ignore quietly.
    }
  }

  if (!token) {
    return (
      <div className="grid gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={create}
          disabled={pending}
        >
          {pending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Link2Icon className="size-3.5" />
          )}
          Create share link
        </Button>
        {error && <p className="text-xs text-rose-300/90">{error}</p>}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
          {url}
        </code>
        <Button variant="outline" size="sm" onClick={copy} aria-label="Copy link">
          {copied ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={revoke}
          disabled={pending}
        >
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : "Revoke"}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-300/90">{error}</p>}
    </div>
  )
}
