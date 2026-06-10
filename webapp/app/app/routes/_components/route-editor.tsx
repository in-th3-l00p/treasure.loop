"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import { SectionHeading } from "@/components/product/section"
import { CheckpointStatus } from "@/components/product/status"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  archiveCheckpoint,
  createCheckpoint,
  reorderCheckpoints,
  rotateCheckpointSecret,
  setRoutePublished,
  updateCheckpoint,
} from "@/lib/event-actions"
import type { CheckpointRow } from "@/lib/event-queries"
import { cn } from "@/lib/utils"

const clueTypeLabel: Record<string, string> = {
  scan: "QR scan",
  staff: "Staff code",
  pair: "Paired fragment",
  nfc: "NFC tag",
}

// Base UI Select renders the selected item's label in the trigger only when
// the Root is given `items` (the popup items aren't mounted while closed).
const clueTypeItems = Object.entries(clueTypeLabel).map(([value, label]) => ({
  value,
  label,
}))

const STATUS_ITEMS = [
  { value: "healthy", label: "Healthy" },
  { value: "busy", label: "Busy" },
  { value: "needs_staff", label: "Needs staff" },
  { value: "offline", label: "Offline" },
]

interface SponsorOption {
  id: string
  name: string
}

interface StaffEntry {
  userId: string
  name: string
  isPrimary: boolean
}

export function RouteEditor({
  route,
  checkpoints,
  sponsors,
  staffByCheckpoint,
  initialSelectedId,
}: {
  route: { id: string; name: string; published: boolean }
  checkpoints: CheckpointRow[]
  sponsors: SponsorOption[]
  staffByCheckpoint: Record<string, StaffEntry[]>
  initialSelectedId: string | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? checkpoints[0]?.id ?? null
  )
  const selected =
    checkpoints.find((cp) => cp.id === selectedId) ?? checkpoints[0] ?? null

  const select = (id: string) => {
    setSelectedId(id)
    // Keep the URL shareable without triggering a navigation.
    window.history.replaceState(null, "", `/app/routes?cp=${id}`)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <SectionHeading
          title="Checkpoints"
          hint={`${checkpoints.length} stops, in player order`}
          className="mb-2"
        />
        <CheckpointList
          route={route}
          checkpoints={checkpoints}
          selectedId={selected?.id ?? null}
          onSelect={select}
        />
        <AddCheckpoint routeId={route.id} />
      </div>

      {selected ? (
        <CheckpointDetail
          key={selected.id}
          checkpoint={selected}
          orderLabel={`Step ${selected.orderIndex}`}
          sponsors={sponsors}
          staff={staffByCheckpoint[selected.id] ?? []}
        />
      ) : (
        <div className="grid place-items-start pt-10 text-sm text-muted-foreground">
          Add your first checkpoint to start building the loop.
        </div>
      )}
    </div>
  )
}

export function PublishToggle({
  route,
}: {
  route: { id: string; published: boolean }
}) {
  const [pending, startTransition] = useTransition()
  return (
    <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
      <span>{route.published ? "Published" : "Draft"}</span>
      <Switch
        checked={route.published}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            await setRoutePublished({ routeId: route.id, published: checked })
          })
        }
      />
    </label>
  )
}

function CheckpointList({
  route,
  checkpoints,
  selectedId,
  onSelect,
}: {
  route: { id: string }
  checkpoints: CheckpointRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= checkpoints.length) return
    const ids = checkpoints.map((cp) => cp.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    startTransition(async () => {
      await reorderCheckpoints({ routeId: route.id, orderedIds: ids })
    })
  }

  const archive = (id: string) => {
    if (!window.confirm("Remove this checkpoint from the route?")) return
    startTransition(async () => {
      await archiveCheckpoint({ checkpointId: id })
    })
  }

  return (
    <ul
      className={cn(
        "grid divide-y divide-border",
        pending && "pointer-events-none opacity-60"
      )}
    >
      {checkpoints.map((cp, i) => {
        const active = cp.id === selectedId
        return (
          <li
            key={cp.id}
            data-active={active || undefined}
            className={cn(
              "group grid grid-cols-[24px_1fr_auto] items-center gap-3 px-1 py-3 transition-colors",
              "hover:bg-muted/30",
              "data-[active]:bg-muted/50"
            )}
          >
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => onSelect(cp.id)}
              className="min-w-0 text-left"
            >
              <p className="truncate text-sm">{cp.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {cp.sponsorName ?? "Unassigned"} · {cp.area ?? "—"}
              </p>
            </button>
            <div className="flex items-center gap-3 pr-1">
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {clueTypeLabel[cp.clueType] ?? cp.clueType}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${cp.name}`}
                      className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[popup-open]:opacity-100"
                    >
                      <MoreVerticalIcon className="size-3.5" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUpIcon /> Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={i === checkpoints.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDownIcon /> Move down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => archive(cp.id)}
                  >
                    <Trash2Icon /> Remove from route
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AddCheckpoint({ routeId }: { routeId: string }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="mt-1 flex w-full items-center justify-center gap-1.5 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <PlusIcon className="size-3.5" /> Add checkpoint
      </button>
    )
  }

  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        startTransition(async () => {
          await createCheckpoint({ routeId, name: name.trim() })
          setName("")
          setAdding(false)
        })
      }}
    >
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Checkpoint name"
        aria-label="Checkpoint name"
        className="h-9 text-sm"
      />
      <Button type="submit" className="h-9" disabled={pending || !name.trim()}>
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : "Add"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-muted-foreground"
        onClick={() => setAdding(false)}
      >
        Cancel
      </Button>
    </form>
  )
}

function CheckpointDetail({
  checkpoint,
  orderLabel,
  sponsors,
  staff,
}: {
  checkpoint: CheckpointRow
  orderLabel: string
  sponsors: SponsorOption[]
  staff: StaffEntry[]
}) {
  const [name, setName] = useState(checkpoint.name)
  const [area, setArea] = useState(checkpoint.area ?? "")
  const [clue, setClue] = useState(checkpoint.clue ?? "")
  const [clueType, setClueType] = useState<string>(checkpoint.clueType)
  const [sponsorId, setSponsorId] = useState<string>(
    checkpoint.sponsorId ?? "none"
  )
  const [status, setStatus] = useState<string>(checkpoint.status)
  const [saving, startSave] = useTransition()
  const [rotating, startRotate] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const sponsorItems = [
    { value: "none", label: "Unassigned" },
    ...sponsors.map((s) => ({ value: s.id, label: s.name })),
  ]

  const dirty =
    name !== checkpoint.name ||
    area !== (checkpoint.area ?? "") ||
    clue !== (checkpoint.clue ?? "") ||
    clueType !== checkpoint.clueType ||
    sponsorId !== (checkpoint.sponsorId ?? "none") ||
    status !== checkpoint.status

  const save = () => {
    setFeedback(null)
    startSave(async () => {
      const res = await updateCheckpoint({
        checkpointId: checkpoint.id,
        name,
        area,
        clue,
        clueType: clueType as CheckpointRow["clueType"],
        sponsorId: sponsorId === "none" ? null : sponsorId,
        status: status as CheckpointRow["status"],
      })
      setFeedback(res.ok ? "Saved." : res.message)
    })
  }

  const rotate = () => {
    if (
      !window.confirm(
        "Rotate this checkpoint's secret? All previous codes become invalid immediately."
      )
    ) {
      return
    }
    startRotate(async () => {
      const res = await rotateCheckpointSecret({
        checkpointId: checkpoint.id,
      })
      setFeedback(res.ok ? "Secret rotated." : res.message)
    })
  }

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            {orderLabel} · {checkpoint.id}
          </p>
          <h2 className="mt-0.5 text-lg font-medium tracking-tight">
            {checkpoint.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {checkpoint.scans.toLocaleString()} scans ·{" "}
            {checkpoint.completion}% of players
          </p>
        </div>
        <CheckpointStatus status={checkpoint.status} />
      </div>

      <div className="grid gap-8">
        <section className="grid gap-4">
          <header>
            <h3 className="text-sm font-medium">Checkpoint</h3>
            <p className="text-xs text-muted-foreground">
              What the player sees on this stop
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-sm"
              />
            </FormRow>
            <FormRow label="Area">
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Sponsor row A"
                className="h-9 text-sm"
              />
            </FormRow>
          </div>
          <FormRow label="Clue shown to the player">
            <Textarea
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </FormRow>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormRow label="Clue type">
              <Select
                value={clueType}
                onValueChange={(v) => v && setClueType(v)}
                items={clueTypeItems}
              >
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clueTypeItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Sponsor">
              <Select
                value={sponsorId}
                onValueChange={(v) => v && setSponsorId(v)}
                items={sponsorItems}
              >
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sponsorItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Status">
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v)}
                items={STATUS_ITEMS}
              >
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={save}
              disabled={saving || !dirty || !name.trim()}
              className="h-8"
            >
              {saving ? (
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            {feedback && (
              <p role="status" className="text-xs text-muted-foreground">
                {feedback}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-3">
          <header>
            <h3 className="text-sm font-medium">Verification</h3>
            <p className="text-xs text-muted-foreground">
              Players prove presence with the rotating 6-digit code on the
              booth kiosk
            </p>
          </header>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              The code rotates every 30 seconds and is derived from this
              checkpoint&apos;s secret.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                render={<Link href={`/app/booth/${checkpoint.id}`} />}
              >
                Open kiosk
                <ArrowUpRightIcon className="ml-1 size-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={rotate}
                disabled={rotating}
              >
                <RefreshCwIcon className="mr-1 size-3" />
                {rotating ? "Rotating…" : "Rotate secret"}
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <header>
            <h3 className="text-sm font-medium">Staff</h3>
            <p className="text-xs text-muted-foreground">
              Booth operators who can show this checkpoint&apos;s code
            </p>
          </header>
          {staff.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                No staff assigned yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                render={<Link href="/app/team" />}
              >
                Invite staff
                <ArrowUpRightIcon className="ml-1 size-3" />
              </Button>
            </div>
          ) : (
            <ul className="grid divide-y divide-border">
              {staff.map((s) => (
                <li
                  key={s.userId}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full bg-primary/12 text-[10px] font-medium text-primary">
                      {initials(s.name)}
                    </span>
                    <p className="text-sm">{s.name}</p>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    {s.isPrimary ? "Primary" : "Backup"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function FormRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
