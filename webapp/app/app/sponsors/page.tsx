import Link from "next/link"

import { BarChart, ChartLegend } from "@/components/product/bar-chart"
import { PageEmpty } from "@/components/product/empty-state"
import { Metric } from "@/components/product/kpi"
import { Section, SectionHeading } from "@/components/product/section"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { CheckpointStatus } from "@/components/product/status"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import {
  getActiveEvent,
  listCheckpoints,
  listHourlyTraffic,
  listSponsors,
} from "@/lib/event-queries"
import { cn } from "@/lib/utils"

const tierLabel: Record<string, string> = {
  gold: "Gold",
  prize: "Prize",
  community: "Community",
}

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  await requireRoles([ROLES.ORGANIZER, ROLES.SPONSOR])
  const event = await getActiveEvent()
  if (!event) {
    return <PageEmpty title="No active event" />
  }
  const [sponsors, checkpoints, { s }] = await Promise.all([
    listSponsors(event.id),
    listCheckpoints(event.id),
    searchParams,
  ])
  if (sponsors.length === 0) {
    return (
      <PageEmpty title="No sponsors yet">
        Add a sponsor in the route builder to see booth traffic here.
      </PageEmpty>
    )
  }

  const activeSponsor = sponsors.find((sp) => sp.id === s) ?? sponsors[0]
  const sponsorCheckpoints = checkpoints.filter(
    (c) => c.sponsorId === activeSponsor.id
  )
  const traffic = await listHourlyTraffic(event.id, {
    sponsorId: activeSponsor.id,
  })
  const maxTraffic = Math.max(...traffic.map((h) => h.scans), 0)
  const busiest = traffic.reduce(
    (best, h) => (h.scans > best.scans ? h : best),
    traffic[0] ?? { hour: "—", scans: 0, completions: 0 }
  )

  return (
    <ProductPage>
      <PageHeader
        title={activeSponsor.name}
        description={
          sponsorCheckpoints.length > 0
            ? `Booth traffic across ${listNames(sponsorCheckpoints.map((c) => c.name))}.`
            : "No checkpoint assigned to this sponsor yet — assign one in the route builder."
        }
      >
        <span className="text-xs text-muted-foreground">
          {tierLabel[activeSponsor.tier] ?? activeSponsor.tier} sponsor
        </span>
      </PageHeader>

      <Section>
        <div className="grid divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {sponsors.map((sp) => {
            const active = sp.id === activeSponsor.id
            return (
              <Link
                key={sp.id}
                href={`/app/sponsors?s=${sp.id}`}
                data-active={active || undefined}
                className={cn(
                  "group relative flex flex-col gap-3 p-5 transition-colors",
                  "hover:bg-muted/30",
                  "data-[active]:bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 h-px transition-colors",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                />
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm">{sp.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tierLabel[sp.tier] ?? sp.tier}
                  </span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-2xl font-medium tabular-nums tracking-tight">
                    {sp.visits.toLocaleString()}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    checkpoint scans
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </Section>

      <Section className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <SectionHeading
            title="Booth traffic"
            hint="Scans recorded at this sponsor's checkpoints, last 8 hours"
          />
          <BarChart
            data={traffic.map((h) => ({
              label: h.hour,
              primary: h.scans,
              secondary: 0,
            }))}
            max={maxTraffic}
            emptyLabel="No scans recorded yet."
          />
          <ChartLegend items={[{ label: "Scans", tone: "primary" }]} />
        </div>

        <div className="grid gap-8">
          <section>
            <div className="mb-5 border-b border-border pb-3">
              <h2 className="text-sm font-medium">Today&apos;s numbers</h2>
              <p className="text-xs text-muted-foreground">
                Live from the scan log
              </p>
            </div>
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Metric
                label="Total scans"
                value={activeSponsor.visits.toLocaleString()}
              />
              <Metric
                label="Busiest hour"
                value={busiest.scans > 0 ? busiest.hour : "—"}
                hint={
                  busiest.scans > 0
                    ? `${busiest.scans} scans`
                    : "No traffic yet"
                }
              />
            </dl>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-3">
              <h2 className="text-sm font-medium">Checkpoints operated</h2>
              <p className="text-xs text-muted-foreground">
                Stations staffed by {activeSponsor.name}
              </p>
            </div>
            {sponsorCheckpoints.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                None yet.{" "}
                <Link
                  href="/app/routes"
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Assign one in the route builder
                </Link>
                .
              </p>
            ) : (
              <ul className="grid divide-y divide-border">
                {sponsorCheckpoints.map((cp) => (
                  <li
                    key={cp.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{cp.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cp.area ?? "—"} · {cp.scans.toLocaleString()} scans
                      </p>
                    </div>
                    <CheckpointStatus status={cp.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Section>

      <Section>
        <SectionHeading
          title="Qualified leads"
          hint="Attendees who opt in to share their wallet with this sponsor at scan time"
        />
        <p className="max-w-md py-2 text-sm text-muted-foreground">
          Lead capture ships with the attendee consent flow. Until then,
          booth conversations stay where they belong: at the booth.
        </p>
      </Section>
    </ProductPage>
  )
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
