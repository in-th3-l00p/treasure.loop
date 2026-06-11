"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setEventVisibility } from "@/lib/event-actions"

type Visibility = "public" | "unlisted" | "private"

// Base UI Select renders the selected label in the trigger only when the
// Root is given `items` (the popup items aren't mounted while closed).
const VISIBILITY_ITEMS: { value: Visibility; label: string; hint: string }[] = [
  {
    value: "public",
    label: "Public",
    hint: "Listed in the Explore directory",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    hint: "Reachable by direct link only",
  },
  {
    value: "private",
    label: "Private",
    hint: "Hidden from discovery",
  },
]

/**
 * Organizer-only control to set the active event's discovery visibility.
 * Public events surface in the player-facing Explore directory; unlisted
 * events are link-only; private events stay hidden.
 *
 * Render this only for organizers (the page gates it); the Server Action
 * re-checks the role and writes an audit row on every change.
 */
export function VisibilityControl({ visibility }: { visibility: Visibility }) {
  const [value, setValue] = useState<Visibility>(visibility)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hint =
    VISIBILITY_ITEMS.find((item) => item.value === value)?.hint ?? ""

  const change = (next: Visibility) => {
    if (next === value) return
    setError(null)
    const prev = value
    setValue(next)
    startTransition(async () => {
      const result = await setEventVisibility(next)
      if (!result.ok) {
        setValue(prev)
        setError(result.message)
      }
    })
  }

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border px-3 py-1.5 text-xs">
      <span className="flex items-center gap-1.5">
        {pending && (
          <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
        )}
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Visibility
        </span>
      </span>
      <Select
        value={value}
        onValueChange={(v) => v && change(v as Visibility)}
        items={VISIBILITY_ITEMS}
        disabled={pending}
      >
        <SelectTrigger
          size="sm"
          className="h-6 min-w-[88px] border-none bg-transparent px-1.5 text-xs dark:bg-transparent dark:hover:bg-transparent"
          aria-label="Discovery visibility"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_ITEMS.map(({ value: v, label }) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <span role="alert" className="text-rose-300/90">
          {error}
        </span>
      ) : (
        <span className="hidden text-muted-foreground sm:inline">{hint}</span>
      )}
    </div>
  )
}
