import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowUpRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
} from "lucide-react"

import { BarChart, ChartLegend } from "@/components/product/bar-chart"
import { PageEmpty } from "@/components/product/empty-state"
import { Kpi } from "@/components/product/kpi"
import { Section, SectionHeading } from "@/components/product/section"
import { ProductPage, PageHeader } from "@/components/product/shell"
import {
  CheckpointStatus,
  checkpointStatusMeta,
} from "@/components/product/status"
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
import { canConfigureEvent } from "@/lib/authz"
import { RehearsalToggle } from "./_components/rehearsal-toggle"
import {
  getActiveEvent,
  getOverviewKpis,
  listCheckpoints,
  listHourlyTraffic,
  listLiveActivity,
  listOpenStaffAlerts,
  listSponsors,
} from "@/lib/event-queries"
import { StaffAlertsList } from "./_components/staff-alerts-card"
import { buildPreflightReport } from "@/lib/preflight"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

export default async function OverviewPage() {
  const subject = await requireMember()
  const isOrganizer = canConfigureEvent(subject)
  const event = await getActiveEvent()
  if (!event) {
    return (
      <PageEmpty title="No active event">
        Run <code className="font-mono text-xs">npm run db:seed</code> from the
        webapp directory to create the pilot event.
      </PageEmpty>
    )
  }

  // A freshly provisioned event hasn't been onboarded. Send the organizer
  // to the guided setup wizard; they can skip from there. Other roles
  // (prize desk, booth, sponsor) just see the normal overview.
  if (isOrganizer && !event.onboardedAt) {
    redirect("/app/onboarding")
  }

  const [
    checkpoints,
    sponsorsList,
    kpis,
    activity,
    traffic,
    preflight,
    staffAlerts,
  ] = await Promise.all([
    listCheckpoints(event.id),
    listSponsors(event.id),
    getOverviewKpis(event.id),
    listLiveActivity(event.id),
    listHourlyTraffic(event.id),
    buildPreflightReport(event.id),
    listOpenStaffAlerts(event.id),
  ])
  const maxTraffic = Math.max(...traffic.map((h) => h.scans), 0)
  const needsAttention = checkpoints.filter((c) => c.status !== "healthy")
  const attentionCount = needsAttention.length + staffAlerts.length

  return (
    <ProductPage>
      <PageHeader
        title="Event overview"
        description="What is happening on the floor right now, and what needs your attention before the next wave."
      >
        {isOrganizer && <RehearsalToggle rehearsal={event.rehearsal} />}
        <Link
          href="/app/preflight"
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
            preflight.ready
              ? "border-emerald-400/30 text-emerald-200/90 hover:border-emerald-400/50"
              : "border-rose-400/30 text-rose-200/90 hover:border-rose-400/50"
          )}
        >
          {preflight.ready ? (
            <CircleCheckIcon className="size-3.5" />
          ) : (
            <CircleAlertIcon className="size-3.5" />
          )}
          {preflight.ready
            ? "Preflight passing"
            : `Preflight: ${preflight.failures} blocking`}
          <ArrowUpRightIcon className="size-3" />
        </Link>
      </PageHeader>

      <Section>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Players"
            value={kpis.activePlayers.toLocaleString()}
            context="Started a loop"
          />
          <Kpi
            label="Route completion"
            value={`${kpis.routeCompletion}%`}
            context="Of all possible scans"
            progress={kpis.routeCompletion}
          />
          <Kpi
            label="Sponsor visits"
            value={kpis.sponsorVisits.toLocaleString()}
            context="Checkpoint scans"
          />
          <Kpi
            label="Badge mints"
            value={kpis.badgeMints.toLocaleString()}
            context={
              kpis.completions > kpis.badgeMints
                ? `${kpis.completions - kpis.badgeMints} finished, not minted`
                : "All finishers minted"
            }
          />
        </div>
      </Section>

      <Section className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionHeading
            title="Hourly traffic"
            hint="Scans and badge mints across all checkpoints, last 8 hours"
          />
          <BarChart
            data={traffic.map((h) => ({
              label: h.hour,
              primary: h.completions,
              secondary: Math.max(0, h.scans - h.completions),
            }))}
            max={maxTraffic}
          />
          <ChartLegend
            items={[
              { label: "Badge mints", tone: "primary" },
              { label: "Scans", tone: "faint" },
            ]}
          />
        </div>

        <div>
          <SectionHeading
            title="Needs attention"
            hint={
              staffAlerts.length > 0
                ? `${staffAlerts.length} help ${
                    staffAlerts.length === 1 ? "request" : "requests"
                  } · ${needsAttention.length} of ${checkpoints.length} checkpoints`
                : `${needsAttention.length} of ${checkpoints.length} checkpoints`
            }
          />
          <StaffAlertsList alerts={staffAlerts} />
          <ul className="grid divide-y divide-border">
            {attentionCount === 0 ? (
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
                        checkpointStatusMeta[cp.status].text
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm">{cp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {checkpointStatusMeta[cp.status].label} · {cp.area}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/app/routes?cp=${cp.id}`}
                    className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Open →
                  </Link>
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
            hint={`All ${checkpoints.length} stops on the loop`}
            trailing={
              <Link
                href="/app/routes"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open route builder
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
                    <CheckpointStatus status={cp.status} />
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
              hint="Scans recorded at each sponsor's checkpoints"
            />
            <ul className="grid gap-4">
              {sponsorsList.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No sponsors yet.
                </li>
              )}
              {sponsorsList.map((s) => {
                const maxVisits = Math.max(
                  ...sponsorsList.map((x) => x.visits),
                  1
                )
                return (
                  <li key={s.id} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {s.visits.toLocaleString()} visits
                      </span>
                    </div>
                    <Progress
                      value={(s.visits / maxVisits) * 100}
                      className="h-1"
                    />
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
                  Nothing has happened yet. Activity surfaces here as staff
                  configure the event and players move around.
                </li>
              )}
              {activity.map((row) => (
                <li key={row.id} className="grid gap-0.5 py-3">
                  <p className="text-sm leading-snug">{row.line}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </ProductPage>
  )
}
