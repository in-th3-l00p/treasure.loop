import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { canViewSponsor } from "@/lib/sponsor-access"
import { leadsToCsv, listSponsorLeads } from "@/lib/sponsor-analytics"

/**
 * GET /api/app/sponsor-leads/[sponsorId]
 *
 * Streams a sponsor's opted-in leads as CSV (wallet, checkpoint,
 * consented-at). Organizer or that sponsor only — `canViewSponsor`
 * enforces the same privacy scope as the report. The rows come from
 * `lead_consents` only; the raw scan log is never exported.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sponsorId: string }> }
) {
  const { sponsorId } = await params

  if (!(await canViewSponsor(sponsorId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const leads = await listSponsorLeads(db, sponsorId)
  const csv = leadsToCsv(leads)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sponsor-leads-${sponsorId}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
