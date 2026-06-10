"use client"

import { useState, useTransition } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inviteStaff } from "@/lib/staff-actions"
import { ROLES, type Role } from "@/lib/authz"

const roleOptions: Array<{ value: Role; label: string; hint: string }> = [
  {
    value: ROLES.ORGANIZER,
    label: "Organizer",
    hint: "Full access: configure the event, invite the team, view PII.",
  },
  {
    value: ROLES.PRIZE_DESK,
    label: "Prize desk",
    hint: "Verifies badges and hands out rewards at the prize desk.",
  },
  {
    value: ROLES.BOOTH_STAFF,
    label: "Booth staff",
    hint: "Operates a checkpoint and shows its rotating code on the kiosk.",
  },
  {
    value: ROLES.SPONSOR,
    label: "Sponsor",
    hint: "Read-only access to their own booth's report.",
  },
]

export function InviteForm() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>(ROLES.BOOTH_STAFF)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null)

  const currentHint = roleOptions.find((o) => o.value === role)?.hint ?? ""

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setFeedback(null)
        startTransition(async () => {
          const result = await inviteStaff({ email, role })
          if (result.ok) {
            setFeedback({ kind: "ok", text: `Invite sent to ${email}.` })
            setEmail("")
          } else {
            setFeedback({ kind: "err", text: result.message })
          }
        })
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-[11px] text-muted-foreground">Email</span>
        <Input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-[11px] text-muted-foreground">Role</span>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as Role)}
          items={roleOptions}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">
          {currentHint}
        </span>
      </label>

      <Button
        type="submit"
        className="h-9"
        disabled={pending || !email.trim()}
      >
        {pending ? (
          <>
            <Loader2Icon className="mr-1.5 size-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send invite"
        )}
      </Button>

      {feedback && (
        <p
          role={feedback.kind === "ok" ? "status" : "alert"}
          className={
            feedback.kind === "ok"
              ? "text-xs text-emerald-300/90"
              : "text-xs text-rose-300/90"
          }
        >
          {feedback.text}
        </p>
      )}
    </form>
  )
}
