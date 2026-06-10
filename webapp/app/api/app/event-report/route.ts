import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { getSubject } from "@/lib/auth-server"
import { ROLES, hasRole } from "@/lib/authz"
import { getActiveEvent } from "@/lib/event-queries"
import { generateEventReport } from "@/lib/event-report"

/**
 * GET /api/app/event-report
 *
 * Streams a Markdown post-event report for the caller's active event as
 * a downloadable file. Organizer-gated — the report aggregates the
 * whole event, so it carries the same trust level as the overview.
 *
 * The numbers all come from `lib/event-report.ts`, which reads real
 * tables only; an empty event produces a report full of zeros and the
 * anomalies that follow, never invented figures.
 */
export async function GET() {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const event = await getActiveEvent(subject.orgId)
  if (!event) {
    return NextResponse.json({ error: "no-event" }, { status: 404 })
  }

  const report = await generateEventReport(event.id, { now: new Date(), db })
  if (!report) {
    return NextResponse.json({ error: "no-event" }, { status: 404 })
  }

  return new NextResponse(report.markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
