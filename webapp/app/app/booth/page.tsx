import Link from "next/link"
import { and, eq, isNull } from "drizzle-orm"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { db } from "@/db/client"
import { checkpoints, staffAssignments } from "@/db/schema"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { getActiveEvent } from "@/lib/event-queries"

/**
 * Booth-staff landing page: lists the checkpoints the signed-in user
 * can operate, sorted by their primary assignment first. From here
 * they pick one to open the kiosk view (`/app/booth/[checkpointId]`).
 */
export default async function BoothIndex() {
  const subject = await requireRoles([ROLES.ORGANIZER, ROLES.BOOTH_STAFF])
  const event = await getActiveEvent()
  if (!event) {
    return <PageEmpty title="No active event" />
  }

  // Organizers see every active checkpoint; booth staff see only the
  // ones they're assigned to.
  const isOrganizer = subject.orgRole === ROLES.ORGANIZER

  const assigned = isOrganizer
    ? await db
        .select({
          id: checkpoints.id,
          name: checkpoints.name,
          area: checkpoints.area,
          status: checkpoints.status,
          isPrimary: staffAssignments.isPrimary,
        })
        .from(checkpoints)
        .leftJoin(
          staffAssignments,
          and(
            eq(staffAssignments.checkpointId, checkpoints.id),
            eq(staffAssignments.userId, subject.userId ?? "")
          )
        )
        .where(
          and(
            eq(checkpoints.eventId, event.id),
            isNull(checkpoints.archivedAt)
          )
        )
        .orderBy(checkpoints.orderIndex)
    : await db
        .select({
          id: checkpoints.id,
          name: checkpoints.name,
          area: checkpoints.area,
          status: checkpoints.status,
          isPrimary: staffAssignments.isPrimary,
        })
        .from(staffAssignments)
        .innerJoin(
          checkpoints,
          eq(checkpoints.id, staffAssignments.checkpointId)
        )
        .where(
          and(
            eq(staffAssignments.userId, subject.userId ?? ""),
            eq(checkpoints.eventId, event.id),
            isNull(checkpoints.archivedAt)
          )
        )
        .orderBy(checkpoints.orderIndex)

  return (
    <ProductPage width="narrow">
      <PageHeader
        title="Booth kiosk"
        description="Pick a checkpoint to display its rotating verification code. Keep the screen visible to attendees during the event."
      />

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any checkpoint assignments yet. Ask your
          organizer to assign you to a checkpoint.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {assigned.map((cp) => (
            <li key={cp.id}>
              <Link
                href={`/app/booth/${cp.id}`}
                className="group grid gap-2 rounded-lg border border-border bg-card/40 p-5 transition-colors hover:border-primary/40 hover:bg-card/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{cp.name}</span>
                  {cp.isPrimary && (
                    <span className="font-mono text-[10px] tracking-[0.12em] text-primary uppercase">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {cp.area ?? "—"}
                </p>
                <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Open kiosk →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ProductPage>
  )
}
