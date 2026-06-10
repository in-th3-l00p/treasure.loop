"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardCheckIcon,
  Loader2Icon,
  MapPinIcon,
  RouteIcon,
  UserPlus2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  completeOnboarding,
  createRoute,
  updateEventSettings,
} from "@/lib/event-actions"
import { ROLES, type Role } from "@/lib/authz"
import { inviteStaff } from "@/lib/staff-actions"
import { cn } from "@/lib/utils"

interface InitialState {
  name: string
  venue: string | null
  datesStart: string
  datesEnd: string
}

const STEPS = [
  { id: "basics", label: "Event", icon: ClipboardCheckIcon },
  { id: "venue", label: "Venue", icon: MapPinIcon },
  { id: "route", label: "Route", icon: RouteIcon },
  { id: "staff", label: "Team", icon: UserPlus2Icon },
  { id: "done", label: "Done", icon: CheckIcon },
] as const

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: ROLES.ORGANIZER, label: "Organizer" },
  { value: ROLES.PRIZE_DESK, label: "Prize desk" },
  { value: ROLES.BOOTH_STAFF, label: "Booth staff" },
  { value: ROLES.SPONSOR, label: "Sponsor" },
]

export function OnboardingWizard({
  initial,
  existingRouteCount,
}: {
  initial: InitialState
  existingRouteCount: number
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Step 1 — basics
  const [name, setName] = useState(initial.name)
  const [datesStart, setDatesStart] = useState(initial.datesStart)
  const [datesEnd, setDatesEnd] = useState(initial.datesEnd)

  // Step 2 — venue
  const [venue, setVenue] = useState(initial.venue ?? "")

  // Step 3 — first route
  const [routeName, setRouteName] = useState("")
  const [routeCreated, setRouteCreated] = useState(existingRouteCount > 0)

  // Step 4 — invite
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>(ROLES.BOOTH_STAFF)
  const [invited, setInvited] = useState<string[]>([])

  const go = (next: number) => {
    setError(null)
    setStep(next)
  }

  const saveBasics = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateEventSettings({
        name: name.trim(),
        datesStart: datesStart || undefined,
        datesEnd: datesEnd || undefined,
      })
      if (result.ok) go(1)
      else setError(result.message)
    })
  }

  const saveVenue = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateEventSettings({ venue: venue.trim() })
      if (result.ok) go(2)
      else setError(result.message)
    })
  }

  const saveRoute = () => {
    setError(null)
    startTransition(async () => {
      const result = await createRoute({ name: routeName.trim() })
      if (result.ok) {
        setRouteCreated(true)
        setRouteName("")
        go(3)
      } else setError(result.message)
    })
  }

  const sendInvite = () => {
    setError(null)
    startTransition(async () => {
      const result = await inviteStaff({ email: email.trim(), role })
      if (result.ok) {
        setInvited((prev) => [...prev, email.trim()])
        setEmail("")
      } else setError(result.message)
    })
  }

  const finish = (skipped: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await completeOnboarding({ skipped })
      if (result.ok) {
        router.replace("/app")
        router.refresh()
      } else setError(result.message)
    })
  }

  return (
    <div className="grid gap-8">
      <Stepper current={step} onJump={go} />

      <div className="rounded-lg border border-border p-6">
        {step === 0 && (
          <StepShell
            title="Name and dates"
            hint="The basics players and staff will see across the console and attendee screens."
          >
            <Field label="Event name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ETH Cluj 2026"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date">
                <Input
                  type="date"
                  value={datesStart}
                  onChange={(e) => setDatesStart(e.target.value)}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={datesEnd}
                  onChange={(e) => setDatesEnd(e.target.value)}
                />
              </Field>
            </div>
            <Actions
              error={error}
              pending={pending}
              onSkip={() => finish(true)}
              primary={{
                label: "Save and continue",
                onClick: saveBasics,
                disabled: !name.trim(),
              }}
            />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Venue"
            hint="Where the hunt happens. Players see this on the attendee surface."
          >
            <Field label="Venue name and area">
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Cluj Innovation Hall — Hall A"
              />
            </Field>
            <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
              Venue-map upload isn&apos;t available yet — there&apos;s no file
              storage configured in this deployment. Capture the venue as text
              for now; map upload is a planned follow-up.
            </p>
            <Actions
              error={error}
              pending={pending}
              onBack={() => go(0)}
              onSkip={() => go(2)}
              primary={{
                label: "Save and continue",
                onClick: saveVenue,
                disabled: false,
              }}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Create your first route"
            hint="A route is the ordered loop of checkpoints players walk. Name it now; add stops in the route builder."
          >
            {routeCreated ? (
              <p className="flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/5 px-3 py-2.5 text-xs text-emerald-200/90">
                <CheckIcon className="size-3.5" />
                You already have a route. Open the route builder to place
                checkpoints.
              </p>
            ) : (
              <Field label="Route name">
                <Input
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="Main Loop"
                />
              </Field>
            )}
            <Actions
              error={error}
              pending={pending}
              onBack={() => go(1)}
              onSkip={() => go(3)}
              primary={
                routeCreated
                  ? { label: "Continue", onClick: () => go(3), disabled: false }
                  : {
                      label: "Create route",
                      onClick: saveRoute,
                      disabled: !routeName.trim(),
                    }
              }
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Invite your team"
            hint="Booth staff, prize-desk operators, and sponsors. They get an email with a join link."
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </Field>
              <Field label="Role">
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="h-9 w-full text-sm sm:w-40">
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
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={pending || !email.trim()}
                onClick={sendInvite}
              >
                {pending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  "Send invite"
                )}
              </Button>
              {invited.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Invited {invited.length}: {invited.join(", ")}
                </span>
              )}
            </div>
            <Actions
              error={error}
              pending={pending}
              onBack={() => go(2)}
              onSkip={() => go(4)}
              primary={{
                label: "Continue",
                onClick: () => go(4),
                disabled: false,
              }}
            />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="You're set"
            hint="Run preflight to confirm routes are published, secrets are present, and staff are assigned before you open doors."
          >
            <p className="text-sm text-muted-foreground">
              That covers the essentials. Anything you skipped can be finished
              from the console — routes, sponsors, team, and rewards each have
              their own page.
            </p>
            {error && (
        <p role="alert" className="text-xs text-rose-300/90">
          {error}
        </p>
      )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="button"
                className="h-9"
                disabled={pending}
                onClick={() => finish(false)}
              >
                {pending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <>
                    Finish and run preflight
                    <ArrowRightIcon className="ml-1 size-4" />
                  </>
                )}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                disabled={pending}
                onClick={() => go(3)}
              >
                Back
              </button>
            </div>
          </StepShell>
        )}
      </div>
    </div>
  )
}

function Stepper({
  current,
  onJump,
}: {
  current: number
  onJump: (i: number) => void
}) {
  return (
    <ol className="flex items-center gap-1 text-xs">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        const Icon = s.icon
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (i <= current ? onJump(i) : undefined)}
              disabled={i > current}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                active && "border-primary/40 bg-primary/10 text-primary",
                done &&
                  "border-border text-muted-foreground hover:text-foreground",
                !active && !done && "border-border text-muted-foreground/50"
              )}
            >
              <Icon className="size-3" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="h-px w-3 bg-border" aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function StepShell({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-5">
      <div className="border-b border-border pb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Actions({
  error,
  pending,
  onBack,
  onSkip,
  primary,
}: {
  error: string | null
  pending: boolean
  onBack?: () => void
  onSkip: () => void
  primary: { label: string; onClick: () => void; disabled: boolean }
}) {
  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="text-xs text-rose-300/90">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="button"
          className="h-9"
          disabled={pending || primary.disabled}
          onClick={primary.onClick}
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            primary.label
          )}
        </Button>
        {onBack && (
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            disabled={pending}
            onClick={onBack}
          >
            Back
          </button>
        )}
        <button
          type="button"
          className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
          disabled={pending}
          onClick={onSkip}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
