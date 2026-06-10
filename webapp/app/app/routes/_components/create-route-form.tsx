"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createRoute } from "@/lib/event-actions"

export function CreateRouteForm() {
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await createRoute({ name: name.trim() })
          if (!res.ok) setError(res.message)
        })
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">Route name</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Main Loop 01"
          className="h-9 text-sm"
        />
      </label>
      <Button
        type="submit"
        className="h-9 justify-self-start"
        disabled={pending || !name.trim()}
      >
        {pending ? (
          <>
            <Loader2Icon className="mr-1.5 size-4 animate-spin" /> Creating…
          </>
        ) : (
          "Create route"
        )}
      </Button>
      {error && <p className="text-xs text-rose-300/90">{error}</p>}
    </form>
  )
}
