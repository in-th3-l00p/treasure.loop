import Link from "next/link"
import {
  ArrowUpRightIcon,
  CircleAlertIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireMember } from "@/lib/auth-server"
import {
  getActiveEvent,
  getOverviewKpis,
  listCheckpoints,
  listLiveActivity,
  listSponsors,
} from "@/lib/event-queries"
import { hourlyTraffic } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusDot: Record<string, string> = {
  healthy: "bg-emerald-400",
  busy: "bg-amber-400",
  needs_staff: "bg-rose-400",
  offline: "bg-muted-foreground",
}

const statusText: Record<string, string> = {
  healthy: "text-emerald-400/90",
  busy: "text-amber-400/90",
  needs_staff: "text-rose-400/90",
  offline: "text-muted-foreground",
}

const statusLabel: Record<string, string> = {
  healthy: "Healthy",
  busy: "Busy",
  needs_staff: "Needs staff",
  offline: "Offline",
}

export default async function OverviewPage() {
  await requireMember()
  const event = await getActiveEvent()
  if (!event) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-medium tracking-tight">
          No active event
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Run <code className="font-mono text-xs">npm run db:seed</code> from the webapp
          directory to create the pilot event.
        </p>
      </div>
    )
  }

  const [checkpoints, sponsorsList, kpis, activity] = await Promise.all([
    listCheckpoints(event.id),
    listSponsors(event.id),
    getOverviewKpis(event.id),
    listLiveActivity(event.id),
  ])
  const maxScans = Math.max(...hourlyTraffic.map((h) => h.scans))
  const needsAttention = checkpoints.filter((c) => c.status !== "healthy")

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <h1 className="text-xl font-medium tracking-tight">
            Event overview
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            What is happening on the floor right now, and what needs your
            attention before the next wave.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-8 text-muted-foreground">
            Export
          </Button>
          <Button variant="outline" className="h-8">
            Open route graph
            <ArrowUpRightIcon className="ml-1 size-3.5" />
          </Button>
        </div>
      </header>

      <Section>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Active players"
            value={kpis.activePlayers.toLocaleString()}
            delta="Started a loop"
          />
          <Kpi
            label="Route completion"
            value={`${kpis.routeCompletion}%`}
            delta="of started loops"
            progress={kpis.routeCompletion}
          />
          <Kpi
            label="Sponsor visits"
            value={kpis.sponsorVisits.toLocaleString()}
            delta="Total checkpoint scans"
          />
          <Kpi
            label="Badge mints"
            value={kpis.badgeMints.toLocaleString()}
            delta={`${Math.max(0, kpis.completions - kpis.badgeMints)} in queue`}
          />
        </div>
      </Section>

      <Section className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionHeading
            title="Hourly traffic"
            hint="Scans and completions across all checkpoints"
            trailing={
              <span className="text-xs text-muted-foreground">
                +18% vs yesterday
              </span>
            }
          />
          <BarChart
            data={hourlyTraffic.map((h) => ({
              label: h.hour,
              primary: h.completions,
              secondary: h.scans - h.completions,
            }))}
            max={maxScans}
          />
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-primary" /> Completions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-primary/20" /> Scans
            </span>
          </div>
        </div>

        <div>
          <SectionHeading
            title="Needs attention"
            hint={`${needsAttention.length} of ${checkpoints.length} checkpoints`}
          />
          <ul className="grid divide-y divide-border">
            {needsAttention.length === 0 ? (
              <li className="py-3 text-sm text-muted-foreground">
                All checkpoints healthy.
              </li>
            ) : (
              needsAttention.map((cp) => (
                <li
                  key={cp.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <CircleAlertIcon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        statusText[cp.status]
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm">{cp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel[cp.status]} · {cp.area}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Assign
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      </Section>

      <Section className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionHeading
            title="Checkpoint health"
            hint="All five stops on Cluj Loop 01"
            trailing={
              <Link
                href="/app/checkpoints"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View all
                <ArrowUpRightIcon className="size-3" />
              </Link>
            }
          />
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-8 px-0 text-[11px] font-normal text-muted-foreground">
                  Checkpoint
                </TableHead>
                <TableHead className="h-8 text-[11px] font-normal text-muted-foreground">
                  Sponsor
                </TableHead>
                <TableHead className="h-8 text-right text-[11px] font-normal text-muted-foreground">
                  Scans
                </TableHead>
                <TableHead className="h-8 text-[11px] font-normal text-muted-foreground">
                  Completion
                </TableHead>
                <TableHead className="h-8 px-0 text-right text-[11px] font-normal text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkpoints.map((cp) => (
                <TableRow key={cp.id} className="border-border">
                  <TableCell className="px-0 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-5 font-mono text-[11px] text-muted-foreground tabular-nums">
                        {String(cp.orderIndex).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="text-sm">{cp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cp.area}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {cp.sponsorName ?? "—"}
                  </TableCell>
                  <TableCell className="py-3.5 text-right font-mono text-sm tabular-nums">
                    {cp.scans.toLocaleString()}
                  </TableCell>
                  <TableCell className="w-[160px] py-3.5">
                    <div className="flex items-center gap-2">
                      <Progress value={cp.completion} className="h-1 flex-1" />
                      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {cp.completion}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-0 py-3.5 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        statusText[cp.status]
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          statusDot[cp.status]
                        )}
                      />
                      {statusLabel[cp.status]}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-10">
          <div>
            <SectionHeading
              title="Sponsor traffic"
              hint="Visits vs conversations today"
            />
            <ul className="grid gap-4">
              {sponsorsList.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No sponsors yet.
                </li>
              )}
              {sponsorsList.map((s) => {
                const rate =
                  s.visits > 0
                    ? Math.round((s.conversations / s.visits) * 100)
                    : 0
                return (
                  <li key={s.id} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {s.conversations} of {s.visits}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={rate} className="h-1 flex-1" />
                      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {rate}%
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <SectionHeading
              title="Live activity"
              hint={
                activity.length === 0
                  ? "No activity yet"
                  : "From the event's audit log"
              }
            />
            <ul className="grid divide-y divide-border">
              {activity.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  Nothing has happened yet. Activity surfaces here as
                  staff configure the event and players move around.
                </li>
              )}
              {activity.map((row) => (
                <li key={row.id} className="grid gap-0.5 py-3">
                  <p className="text-sm leading-snug">{row.line}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatActivityTime(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  )
}

function formatActivityTime(d: Date): string {
  const ms = Date.now() - d.getTime()
  if (ms < 60_000) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function Section({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("mb-12 last:mb-0", className)}>{children}</section>
  )
}

function SectionHeading({
  title,
  hint,
  trailing,
}: {
  title: string
  hint?: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      {trailing}
    </div>
  )
}

function BarChart({
  data,
  max,
  height = 168,
}: {
  data: { label: string; primary: number; secondary: number }[]
  max: number
  height?: number
}) {
  return (
    <div>
      <div
        className="relative grid gap-2"
        style={{
          height,
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
        }}
      >
        {data.map((d) => {
          const total = d.primary + d.secondary
          const totalPct = Math.max((total / max) * 100, 2)
          const primaryPct = total > 0 ? (d.primary / total) * 100 : 0
          return (
            <div key={d.label} className="relative h-full">
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-[2px]"
                style={{ height: `${totalPct}%` }}
              >
                <div
                  className="w-full bg-primary/20"
                  style={{ height: `${100 - primaryPct}%` }}
                />
                <div
                  className="w-full bg-primary"
                  style={{ height: `${primaryPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="mt-2 grid gap-2 border-t border-border pt-2"
        style={{
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
        }}
      >
        {data.map((d) => (
          <span
            key={d.label}
            className="text-center font-mono text-[10px] text-muted-foreground"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  delta,
  progress,
  sparkline,
}: {
  label: string
  value: string
  delta: string
  progress?: number
  sparkline?: number[]
}) {
  return (
    <div className="group flex flex-col gap-3 bg-background p-5 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sparkline && <Sparkline data={sparkline} />}
      </div>
      <p className="text-3xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      {progress !== undefined && (
        <Progress value={progress} className="h-[2px]" />
      )}
      <p className="text-xs text-muted-foreground">{delta}</p>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 56
  const height = 16
  const stepX = width / (data.length - 1)
  const points = data
    .map((d, i) => `${i * stepX},${height - ((d - min) / range) * height}`)
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-muted-foreground/50 transition-colors group-hover:text-primary"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
