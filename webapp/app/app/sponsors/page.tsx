import { headers } from "next/headers"
import Link from "next/link"
import { DownloadIcon } from "lucide-react"

import { db } from "@/db/client"
import { PageEmpty } from "@/components/product/empty-state"
import { Section, SectionHeading } from "@/components/product/section"
import { ProductPage, PageHeader } from "@/components/product/shell"
import {
  SponsorReportView,
  tierLabel,
} from "@/components/product/sponsor-report"
import { buttonVariants } from "@/components/ui/button"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { activeShareLinkForSponsor } from "@/lib/share-links"
import { resolveSponsorScope } from "@/lib/sponsor-access"
import {
  getSponsorReport,
  listSponsorLeads,
  sponsorVisitCount,
} from "@/lib/sponsor-analytics"
import { cn } from "@/lib/utils"

import { ShareLinkControl } from "./_components/share-link-control"

/**
 * Sponsor report — real data, privacy-scoped.
 *
 * Organizers see every sponsor; a `sponsor`-role user sees only the
 * booth(s) matched to their account email (`resolveSponsorScope`). The
 * report renders aggregate traffic + talk-through for anyone permitted;
 * individual opted-in leads (from `lead_consents`) render in the same
 * scope. The raw per-wallet scan log is never shown here.
 */
export default async function SponsorsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  await requireRoles([ROLES.ORGANIZER, ROLES.SPONSOR])

  const [scope, { s }] = await Promise.all([
    resolveSponsorScope(),
    searchParams,
  ])

  if (!scope) {
    return <PageEmpty title="No active event" />
  }
  if (scope.sponsors.length === 0) {
    return (
      <PageEmpty title="No sponsors to show">
        {scope.isOrganizer
          ? "Add a sponsor in the route builder to see booth traffic here."
          : "Your account isn't linked to a sponsor booth for this event yet. Ask the organizer to set your contact email on the sponsor."}
      </PageEmpty>
    )
  }

  // Visit count per sponsor for the selector strip.
  const sponsorVisits = await Promise.all(
    scope.sponsors.map((sp) => sponsorVisitCount(db, sp.id))
  )
  const visitsById = new Map(
    scope.sponsors.map((sp, i) => [sp.id, sponsorVisits[i]])
  )

  const activeSponsor =
    scope.sponsors.find((sp) => sp.id === s) ?? scope.sponsors[0]

  const [report, leads, link] = await Promise.all([
    getSponsorReport(db, {
      id: activeSponsor.id,
      name: activeSponsor.name,
      tier: activeSponsor.tier,
    }),
    listSponsorLeads(db, activeSponsor.id),
    activeShareLinkForSponsor(db, activeSponsor.id),
  ])

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("host") ?? ""
  const baseUrl = host ? `${proto}://${host}` : ""

  return (
    <ProductPage>
      <PageHeader
        title={activeSponsor.name}
        description={
          report.checkpoints.length > 0
            ? `Booth traffic across ${listNames(report.checkpoints.map((c) => c.name))}.`
            : "No checkpoint assigned to this sponsor yet. Assign one in the route builder."
        }
      >
        <span className="text-xs text-muted-foreground">
          {tierLabel[activeSponsor.tier] ?? activeSponsor.tier} sponsor
        </span>
        <a
          href={`/api/app/sponsor-leads/${activeSponsor.id}`}
          download
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <DownloadIcon className="size-3.5" />
          Export leads
        </a>
      </PageHeader>

      {scope.sponsors.length > 1 && (
        <Section>
          <div className="grid divide-y divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {scope.sponsors.map((sp) => {
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
                      {(visitsById.get(sp.id) ?? 0).toLocaleString()}
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
      )}

      <SponsorReportView data={report} leads={leads} />

      <Section>
        <SectionHeading
          title="Shareable report link"
          hint="A revocable public link to this booth's aggregate report. No login, leads stay private."
        />
        <div className="max-w-2xl py-1">
          <ShareLinkControl
            eventId={scope.eventId}
            sponsorId={activeSponsor.id}
            initialToken={link?.token ?? null}
            baseUrl={baseUrl}
          />
        </div>
      </Section>
    </ProductPage>
  )
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}
