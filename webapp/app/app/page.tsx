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
  activity,
  checkpoints,
  event,
  hourlyTraffic,
  sponsors,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusDot: Record<string, string> = {
  Healthy: "bg-emerald-400",
  Busy: "bg-amber-400",
  "Needs staff": "bg-rose-400",
  Offline: "bg-muted-foreground",
}

const statusText: Record<string, string> = {
  Healthy: "text-emerald-400/90",
  Busy: "text-amber-400/90",
  "Needs staff": "text-rose-400/90",
  Offline: "text-muted-foreground",
}

export default async function OverviewPage() {
  await requireMember()
  const maxScans = Math.max(...hourlyTraffic.map((h) => h.scans))
  const needsAttention = checkpoints.filter((c) => c.status !== "Healthy")

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
            value={event.activePlayers.toLocaleString()}
            delta="+38 last hour"
            sparkline={[120, 180, 240, 290, 310, 348, 372, 386]}
          />
          <Kpi
            label="Route completion"
            value={`${event.routeCompletion}%`}
            delta="of started loops"
            progress={event.routeCompletion}
          />
          <Kpi
            label="Sponsor visits"
            value={event.sponsorVisits.toLocaleString()}
            delta="+312 today"
            sparkline={[420, 680, 1020, 1480, 1980, 2380, 2810, 3124]}
          />
          <Kpi
            label="Badge mints"
            value={event.badgeMints.toLocaleString()}
            delta={`${event.completions - event.badgeMints} in queue`}
            sparkline={[8, 22, 36, 54, 72, 88, 104, 118]}
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
                        {cp.status} · {cp.area}
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
                        {cp.id.replace("CP-", "")}
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
                    {cp.sponsor}
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
                      {cp.status}
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
              {sponsors.map((s) => {
                const rate = Math.round((s.conversations / s.visits) * 100)
                return (
                  <li key={s.name} className="grid gap-1.5">
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
            <SectionHeading title="Live activity" hint="Last 15 minutes" />
            <ul className="grid divide-y divide-border">
              {activity.map((line, i) => (
                <li key={line} className="grid gap-0.5 py-3">
                  <p className="text-sm leading-snug">{line}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {`${15 - i * 2} min ago`}
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
