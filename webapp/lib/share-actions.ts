"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db/client"
import { auditLog, shareLinks, sponsors } from "@/db/schema"
import { getSubject } from "./auth-server"
import { canViewSponsor } from "./sponsor-access"
import { activeShareLinkForSponsor, generateShareToken } from "./share-links"

/**
 * Server Actions for the revocable sponsor share link.
 *
 * Authorization reuses `canViewSponsor` so the same privacy scope that
 * gates the report gates link management: an organizer, or the sponsor
 * whose booth it is, may create/revoke. Each mutation writes an
 * `audit_log` row in the same transaction as the change.
 */

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; message: string }

function err<T = unknown>(error: string, message: string): ActionResult<T> {
  return { ok: false, error, message }
}

/**
 * Create a share link for a sponsor, or return the existing active one
 * (idempotent — one live link per booth at a time).
 */
export async function createShareLink(input: {
  eventId: string
  sponsorId: string
}): Promise<ActionResult<{ token: string }>> {
  if (!(await canViewSponsor(input.sponsorId)))
    return err<{ token: string }>(
      "forbidden",
      "You can't manage this sponsor's link."
    )

  // Derive the event from the sponsor row — never trust a client-supplied
  // eventId, which would let an authorized caller stamp the link/audit row
  // with an arbitrary event.
  const [sponsor] = await db
    .select({ eventId: sponsors.eventId })
    .from(sponsors)
    .where(eq(sponsors.id, input.sponsorId))
    .limit(1)
  if (!sponsor)
    return err<{ token: string }>("not-found", "Sponsor not found.")
  const eventId = sponsor.eventId

  const subject = await getSubject()
  const existing = await activeShareLinkForSponsor(db, input.sponsorId)
  if (existing) return { ok: true, data: { token: existing.token } }

  const token = generateShareToken()
  await db.transaction(async (tx) => {
    await tx.insert(shareLinks).values({
      token,
      eventId,
      sponsorId: input.sponsorId,
      createdBy: subject.userId ?? "unknown",
    })
    await tx.insert(auditLog).values({
      eventId,
      actor: subject.userId ?? "unknown",
      action: "sponsor.share_link_created",
      target: input.sponsorId,
      meta: { token },
    })
  })

  revalidatePath("/app/sponsors")
  return { ok: true, data: { token } }
}

/** Revoke every active share link for a sponsor (flips `revoked_at`). */
export async function revokeShareLink(input: {
  eventId: string
  sponsorId: string
}): Promise<ActionResult> {
  if (!(await canViewSponsor(input.sponsorId)))
    return err("forbidden", "You can't manage this sponsor's link.")

  const subject = await getSubject()
  await db.transaction(async (tx) => {
    const revoked = await tx
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(shareLinks.sponsorId, input.sponsorId),
          isNull(shareLinks.revokedAt)
        )
      )
      .returning()
    await tx.insert(auditLog).values({
      eventId: input.eventId,
      actor: subject.userId ?? "unknown",
      action: "sponsor.share_link_revoked",
      target: input.sponsorId,
      meta: { tokens: revoked.map((r) => r.token) },
    })
  })

  revalidatePath("/app/sponsors")
  return { ok: true }
}
