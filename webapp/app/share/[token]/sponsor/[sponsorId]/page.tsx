import { db } from "@/db/client"
import { ProductPage, PageHeader } from "@/components/product/shell"
import {
  SponsorReportView,
  tierLabel,
} from "@/components/product/sponsor-report"
import { resolveShareLink } from "@/lib/share-links"
import { getSponsorReport } from "@/lib/sponsor-analytics"

/**
 * Public, unauthenticated read-only sponsor report.
 *
 * `/share/[token]/sponsor/[sponsorId]` renders the sponsor's AGGREGATE
 * report when the token is valid, not revoked, and matches the sponsor.
 * Otherwise it shows an honest "link expired/revoked" state. The same
 * privacy scope applies as the authed report: aggregates only — never
 * individual leads (we pass `leads={null}`).
 */
export default async function SponsorSharePage({
  params,
}: {
  params: Promise<{ token: string; sponsorId: string }>
}) {
  const { token, sponsorId } = await params

  const link = await resolveShareLink(db, token, sponsorId)
  if (!link) {
    return (
      <div className="product-shell flex min-h-screen items-center justify-center px-6 py-16">
        <div className="grid max-w-md gap-3 text-center">
          <h1 className="text-xl font-medium tracking-tight">
            This link isn&apos;t active
          </h1>
          <p className="text-sm text-muted-foreground">
            The share link has expired or been revoked. Ask the event
            organizer for a fresh one.
          </p>
        </div>
      </div>
    )
  }

  const data = await getSponsorReport(db, {
    id: link.sponsorId,
    name: link.sponsorName,
    tier: link.sponsorTier,
  })

  return (
    <div className="product-shell min-h-screen">
      <ProductPage>
        <PageHeader
          title={link.sponsorName}
          description="Shared read-only booth report. Aggregate traffic only."
        >
          <span className="text-xs text-muted-foreground">
            {tierLabel[data.sponsor.tier] ?? data.sponsor.tier} sponsor
          </span>
        </PageHeader>
        <SponsorReportView data={data} leads={null} />
      </ProductPage>
    </div>
  )
}
