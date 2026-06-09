import Link from "next/link"
import {
  ArrowUpRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ClockIcon,
  RadioTowerIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  activity,
  checkpoints,
  event,
  hourlyTraffic,
  sponsors,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  Healthy: "text-emerald-400",
  Busy: "text-amber-400",
  "Needs staff": "text-rose-400",
  Offline: "text-muted-foreground",
}

export default function OverviewPage() {
  const maxScans = Math.max(...hourlyTraffic.map((h) => h.scans))
  const needsAttention = checkpoints.filter((c) => c.status !== "Healthy")

  return (
    <div className="px-5 pt-6 pb-14 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Today · {event.dates.split("-")[0].trim()} July
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            Event overview
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            What is happening on the floor right now, and what needs your attention before the next wave.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8">
            Export report
          </Button>
          <Button className="h-8">
            Open route graph
            <ArrowUpRightIcon className="ml-1 size-3.5" />
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active players"
          value={event.activePlayers.toLocaleString()}
          delta="+38 in last hour"
          trend="up"
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
          trend="up"
        />
        <Kpi
          label="Badge mints"
          value={event.badgeMints.toLocaleString()}
          delta={`Queue: ${event.completions - event.badgeMints}`}
          trend="neutral"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-medium">Hourly traffic</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Scans across all checkpoints versus completions
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="h-6 rounded-full border-border bg-secondary/40 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
              >
                <TrendingUpIcon className="mr-1 size-3 text-emerald-400" />
                +18% vs yesterday
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-2.5">
              {hourlyTraffic.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
                    <div
                      className="w-full rounded-t-sm bg-primary/70"
                      style={{ height: `${(h.completions / maxScans) * 100}%` }}
                      title={`${h.completions} completions`}
                    />
                    <div
                      className="w-full rounded-sm bg-primary/15"
                      style={{
                        height: `${((h.scans - h.completions) / maxScans) * 100}%`,
                      }}
                      title={`${h.scans} scans`}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {h.hour}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary/70" /> Completions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary/15" /> Scans
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Needs attention</CardTitle>
            <CardDescription className="text-xs">
              Checkpoints not in Healthy state
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {needsAttention.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-3 text-sm text-muted-foreground">
                <CircleCheckIcon className="size-4 text-emerald-400" /> All
                checkpoints healthy
              </div>
            ) : (
              needsAttention.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <CircleAlertIcon
                      className={cn("mt-0.5 size-4 shrink-0", statusStyles[cp.status])}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cp.status} · {cp.area}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    Assign
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">Checkpoint health</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                render={<Link href="/app/checkpoints" />}
              >
                View all
                <ArrowUpRightIcon className="ml-0.5 size-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60">
                  <TableHead className="h-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Checkpoint
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Sponsor
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Scans
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Completion
                  </TableHead>
                  <TableHead className="h-8 text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkpoints.map((cp) => (
                  <TableRow key={cp.id} className="border-border/60">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-7 place-items-center rounded-md border border-border bg-secondary/40 font-mono text-[10px] text-muted-foreground">
                          {cp.id.replace("CP-", "")}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{cp.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {cp.area}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cp.sponsor}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">
                      {cp.scans.toLocaleString()}
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <div className="flex items-center gap-2">
                        <Progress value={cp.completion} className="h-1.5 flex-1" />
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {cp.completion}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs",
                          statusStyles[cp.status]
                        )}
                      >
                        <span className="status-dot" /> {cp.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sponsor traffic</CardTitle>
              <CardDescription className="text-xs">
                Visits vs conversations today
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pb-4">
              {sponsors.map((s) => {
                const rate = Math.round((s.conversations / s.visits) * 100)
                return (
                  <div key={s.name} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {s.conversations} / {s.visits}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={rate} className="h-1 flex-1" />
                      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                        {rate}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Live activity</CardTitle>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <RadioTowerIcon className="size-3 text-emerald-400" />
                  Streaming
                </span>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="grid gap-2.5">
                {activity.map((line, i) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CircleDotIcon
                      className={cn(
                        "mt-0.5 size-3 shrink-0",
                        i === 0 ? "text-primary" : "text-muted-foreground/40"
                      )}
                    />
                    <div className="flex-1">
                      <p className="text-[13px] leading-snug">{line}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {`${15 - i * 2} min ago`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  delta,
  trend,
  progress,
}: {
  label: string
  value: string
  delta: string
  trend?: "up" | "down" | "neutral"
  progress?: number
}) {
  const trendIcon =
    trend === "up" ? (
      <TrendingUpIcon className="size-3 text-emerald-400" />
    ) : trend === "down" ? (
      <TrendingUpIcon className="size-3 rotate-180 text-rose-400" />
    ) : (
      <ClockIcon className="size-3 text-muted-foreground" />
    )

  return (
    <Card>
      <CardContent className="grid gap-1.5 py-4">
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-[26px] font-semibold tabular-nums tracking-tight">
          {value}
        </p>
        {progress !== undefined ? (
          <Progress value={progress} className="h-1" />
        ) : (
          <Separator className="bg-border/60" />
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {trendIcon} {delta}
        </p>
      </CardContent>
    </Card>
  )
}
