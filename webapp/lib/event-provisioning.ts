import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db/client"
import { auditLog, events } from "@/db/schema"

/**
 * Server-side helpers for tying a Clerk Organization to an `events`
 * row. The lifecycle is:
 *
 *   organization.created  → ensureEventForOrg
 *   organization.updated  → ensureEventForOrg + sync name
 *   organization.deleted  → archiveEventForOrg
 *
 * Both webhook delivery and direct page calls share the same code, so
 * a slow webhook can't deadlock a user trying to enter their console.
 */

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return slug.length > 0 ? slug : fallback
}

export interface EnsureEventArgs {
  orgId: string
  orgName: string
}

/**
 * Idempotently create (or update the name of) an event for the given
 * Clerk org id. Returns the event row.
 */
export async function ensureEventForOrg(
  args: EnsureEventArgs
): Promise<{ id: string; name: string; orgId: string }> {
  const existing = await db
    .select({
      id: events.id,
      name: events.name,
      orgId: events.orgId,
      archivedAt: events.archivedAt,
    })
    .from(events)
    .where(eq(events.orgId, args.orgId))
    .limit(1)

  if (existing.length > 0) {
    const row = existing[0]
    // Unarchive on re-creation. Sync name if it changed in Clerk.
    if (row.name !== args.orgName || row.archivedAt) {
      await db
        .update(events)
        .set({ name: args.orgName, archivedAt: null })
        .where(eq(events.orgId, args.orgId))
    }
    return { id: row.id, name: args.orgName, orgId: args.orgId }
  }

  // First time we see this org.
  const stamp = Date.now().toString(36)
  const [inserted] = await db
    .insert(events)
    .values({
      orgId: args.orgId,
      name: args.orgName,
      slug: slugify(args.orgName, `event-${stamp}`),
      status: "draft",
      network: "base-sepolia",
    })
    .returning()

  await db.insert(auditLog).values({
    eventId: inserted.id,
    actor: "clerk-webhook",
    action: "event.created",
    target: inserted.id,
    meta: { orgId: args.orgId, orgName: args.orgName },
  })

  return { id: inserted.id, name: inserted.name, orgId: inserted.orgId }
}

/** Soft-delete the event for an org. */
export async function archiveEventForOrg(orgId: string): Promise<void> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), isNull(events.archivedAt)))
    .limit(1)

  if (!row) return

  await db
    .update(events)
    .set({ archivedAt: new Date() })
    .where(eq(events.id, row.id))

  await db.insert(auditLog).values({
    eventId: row.id,
    actor: "clerk-webhook",
    action: "event.archived",
    target: row.id,
    meta: { orgId },
  })
}

/**
 * Resolve the active event id for the currently-signed-in operator.
 * Returns null if they aren't in an org or no event is set up for it.
 */
export async function getEventForOperator(
  orgId: string | null | undefined
): Promise<{ id: string; name: string; slug: string } | null> {
  if (!orgId) return null
  const [row] = await db
    .select({ id: events.id, name: events.name, slug: events.slug })
    .from(events)
    .where(and(eq(events.orgId, orgId), isNull(events.archivedAt)))
    .limit(1)
  return row ?? null
}
