import { BarChart, ChartLegend } from "@/components/product/bar-chart"
import { Metric } from "@/components/product/kpi"
import { Section, SectionHeading } from "@/components/product/section"
import { shortAddress } from "@/lib/format"
import type { SponsorLead, SponsorReportData } from "@/lib/sponsor-analytics"

const tierLabel: Record<string, string> = {
  gold: "Gold",
  prize: "Prize",
  community: "Community",
}

/**
 * Read-only aggregate report for one sponsor. Shared by the operator
 * console (`/app/sponsors`) and the public share page so the two surfaces
 * can never drift on what a sponsor is allowed to see.
 *
 * Aggregates (visits, hourly traffic, talk-through) are always rendered.
 * Individual wallets render ONLY when `leads` is provided — the caller
 * passes it solely after the privacy gate permits, and passes `null`
 * otherwise (honest empty state, never invented).
 */
export function SponsorReportView({
  data,
  leads,
}: {
  data: SponsorReportData
  leads: SponsorLead[] | null
}) {
  const maxTraffic = Math.max(...data.hourly.map((h) => h.scanCount), 0)
  const busiest = data.hourly.reduce(
    (best, h) => (h.scanCount > best.scanCount ? h : best),
    data.hourly[0] ?? { hour: "—", scanCount: 0, bucketStart: new Date() }
  )

  return (
    <>
      <Section className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <SectionHeading
            title="Booth traffic"
            hint="Scans recorded at this sponsor's checkpoints, last 8 hours"
          />
          <BarChart
            data={data.hourly.map((h) => ({
              label: h.hour,
              primary: h.scanCount,
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
                Aggregates from the scan log
              </p>
            </div>
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Metric
                label="Total scans"
                value={data.visits.toLocaleString()}
              />
              <Metric
                label="Talk-through"
                value={data.talkThrough.toLocaleString()}
                hint="Kept moving within 10 min"
              />
              <Metric
                label="Busiest hour"
                value={busiest.scanCount > 0 ? busiest.hour : "—"}
                hint={
                  busiest.scanCount > 0
                    ? `${busiest.scanCount} scans`
                    : "No traffic yet"
                }
              />
              <Metric
                label="Opted-in leads"
                value={data.leadCount.toLocaleString()}
                hint="Shared their wallet"
              />
            </dl>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-3">
              <h2 className="text-sm font-medium">Checkpoints operated</h2>
              <p className="text-xs text-muted-foreground">
                Stations staffed by {data.sponsor.name}
              </p>
            </div>
            {data.checkpoints.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="grid divide-y divide-border">
                {data.checkpoints.map((cp) => (
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
          hint="Attendees who opted in to share their wallet with this sponsor at scan time"
        />
        {leads === null ? (
          <p className="max-w-md py-2 text-sm text-muted-foreground">
            Individual wallets are visible to {data.sponsor.name} and the
            organizer only. Aggregate counts above are shared.
          </p>
        ) : leads.length === 0 ? (
          <p className="max-w-md py-2 text-sm text-muted-foreground">
            No leads yet. A wallet appears here only after the attendee
            opts in at the booth — booth conversations stay private until
            then.
          </p>
        ) : (
          <ul className="grid divide-y divide-border">
            {leads.map((l) => (
              <li
                key={`${l.wallet}-${l.consentedAt.getTime()}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="font-mono text-sm">
                  {shortAddress(l.wallet)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {l.checkpointName ?? "—"} ·{" "}
                  {l.consentedAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

export { tierLabel }
