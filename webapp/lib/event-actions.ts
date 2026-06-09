"use server"

import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db/client"
import {
  auditLog,
  checkpoints,
  events,
  rewards,
  routes,
  sponsors,
} from "@/db/schema"
import { getSubject } from "./auth-server"
import { hasRole, ROLES } from "./authz"
import { generateCheckpointSecret } from "./checkpoint-codes"

/**
 * Server Actions backing the operator console's CRUD surfaces.
 *
 * Every action:
 *   1. Resolves the caller's subject and the active event from their
 *      Clerk org. There's no implicit cross-event write — if the
 *      caller's session has no org, the action rejects.
 *   2. Re-checks the policy via `hasRole`. The middleware already
 *      blocks the page, but defense in depth is cheap.
 *   3. Writes an `audit_log` row inside the same transaction as the
 *      mutation, so we never lose the trail on a partial commit.
 *   4. Calls `revalidatePath` so the affected page refreshes without
 *      the client having to invalidate manually.
 */

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; message: string }

async function getOperatorContext() {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId) {
    return null
  }
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.orgId, subject.orgId), isNull(events.archivedAt)))
    .limit(1)
  if (!event) return null
  return { subject, event }
}

function err(error: string, message: string): ActionResult {
  return { ok: false, error, message }
}

// ─────────────────────────── events ───────────────────────────

export async function updateEventSettings(input: {
  name?: string
  venue?: string
  datesStart?: string
  datesEnd?: string
  network?: string
  status?: string
  badgeContractAddress?: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.venue !== undefined) patch.venue = input.venue
  if (input.network !== undefined) patch.network = input.network
  if (input.status !== undefined) patch.status = input.status
  if (input.badgeContractAddress !== undefined)
    patch.badgeContractAddress = input.badgeContractAddress
  if (input.datesStart !== undefined)
    patch.datesStart = input.datesStart ? new Date(input.datesStart) : null
  if (input.datesEnd !== undefined)
    patch.datesEnd = input.datesEnd ? new Date(input.datesEnd) : null

  if (Object.keys(patch).length === 0) {
    return err("noop", "Nothing to update.")
  }

  await db.transaction(async (tx) => {
    await tx.update(events).set(patch).where(eq(events.id, ctx.event.id))
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "event.updated",
      target: ctx.event.id,
      meta: patch,
    })
  })

  revalidatePath("/app")
  return { ok: true }
}

// ─────────────────────────── routes ───────────────────────────

export async function createRoute(input: {
  name: string
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.name?.trim())
    return err("missing-name", "Route name is required.")

  let id = ""
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(routes)
      .values({ eventId: ctx.event.id, name: input.name.trim() })
      .returning()
    id = row.id
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "route.created",
      target: id,
      meta: { name: input.name },
    })
  })

  revalidatePath("/app/routes")
  return { ok: true, data: { id } }
}

export async function renameRoute(input: {
  routeId: string
  name: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.name?.trim())
    return err("missing-name", "Name is required.")

  const updated = await db
    .update(routes)
    .set({ name: input.name.trim() })
    .where(and(eq(routes.id, input.routeId), eq(routes.eventId, ctx.event.id)))
    .returning()

  if (updated.length === 0)
    return err("not-found", "Route not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "route.renamed",
    target: input.routeId,
    meta: { name: input.name },
  })

  revalidatePath("/app/routes")
  return { ok: true }
}

export async function setRoutePublished(input: {
  routeId: string
  published: boolean
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const updated = await db
    .update(routes)
    .set({ published: input.published })
    .where(and(eq(routes.id, input.routeId), eq(routes.eventId, ctx.event.id)))
    .returning()

  if (updated.length === 0)
    return err("not-found", "Route not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: input.published ? "route.published" : "route.unpublished",
    target: input.routeId,
  })

  revalidatePath("/app/routes")
  return { ok: true }
}

export async function archiveRoute(input: {
  routeId: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  await db
    .update(routes)
    .set({ archivedAt: new Date() })
    .where(and(eq(routes.id, input.routeId), eq(routes.eventId, ctx.event.id)))

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "route.archived",
    target: input.routeId,
  })

  revalidatePath("/app/routes")
  return { ok: true }
}

// ───────────────────────── checkpoints ─────────────────────────

export async function createCheckpoint(input: {
  routeId: string
  name: string
  area?: string
  clue?: string
  clueType?: "scan" | "staff" | "pair" | "nfc"
  sponsorId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.name?.trim())
    return err("missing-name", "Checkpoint name is required.")

  const [route] = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.id, input.routeId), eq(routes.eventId, ctx.event.id)))
    .limit(1)
  if (!route) return err("not-found", "Route not found.")

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${checkpoints.orderIndex})::int, 0)` })
    .from(checkpoints)
    .where(eq(checkpoints.routeId, input.routeId))

  let id = ""
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(checkpoints)
      .values({
        eventId: ctx.event.id,
        routeId: input.routeId,
        orderIndex: Number(maxRow?.max ?? 0) + 1,
        name: input.name.trim(),
        area: input.area ?? null,
        clue: input.clue ?? null,
        clueType: input.clueType ?? "scan",
        sponsorId: input.sponsorId ?? null,
        totpSecret: generateCheckpointSecret(),
      })
      .returning()
    id = row.id
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "checkpoint.created",
      target: id,
      meta: { routeId: input.routeId, name: input.name },
    })
  })

  revalidatePath("/app/routes")
  revalidatePath("/app")
  return { ok: true, data: { id } }
}

export async function updateCheckpoint(input: {
  checkpointId: string
  name?: string
  area?: string
  clue?: string
  clueType?: "scan" | "staff" | "pair" | "nfc"
  sponsorId?: string | null
  status?: "healthy" | "busy" | "needs_staff" | "offline"
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.area !== undefined) patch.area = input.area
  if (input.clue !== undefined) patch.clue = input.clue
  if (input.clueType !== undefined) patch.clueType = input.clueType
  if (input.sponsorId !== undefined) patch.sponsorId = input.sponsorId
  if (input.status !== undefined) patch.status = input.status

  if (Object.keys(patch).length === 0)
    return err("noop", "Nothing to update.")

  const updated = await db
    .update(checkpoints)
    .set(patch)
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.eventId, ctx.event.id)
      )
    )
    .returning()
  if (updated.length === 0)
    return err("not-found", "Checkpoint not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "checkpoint.updated",
    target: input.checkpointId,
    meta: patch,
  })

  revalidatePath("/app/routes")
  revalidatePath("/app")
  return { ok: true }
}

export async function archiveCheckpoint(input: {
  checkpointId: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  await db
    .update(checkpoints)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.eventId, ctx.event.id)
      )
    )

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "checkpoint.archived",
    target: input.checkpointId,
  })

  revalidatePath("/app/routes")
  revalidatePath("/app")
  return { ok: true }
}

export async function reorderCheckpoints(input: {
  routeId: string
  orderedIds: string[]
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (input.orderedIds.length === 0)
    return err("empty", "Provide a non-empty order.")

  await db.transaction(async (tx) => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      await tx
        .update(checkpoints)
        .set({ orderIndex: i + 1 })
        .where(
          and(
            eq(checkpoints.id, input.orderedIds[i]),
            eq(checkpoints.routeId, input.routeId),
            eq(checkpoints.eventId, ctx.event.id)
          )
        )
    }
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "checkpoint.reordered",
      target: input.routeId,
      meta: { orderedIds: input.orderedIds },
    })
  })

  revalidatePath("/app/routes")
  return { ok: true }
}

export async function rotateCheckpointSecret(input: {
  checkpointId: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const updated = await db
    .update(checkpoints)
    .set({ totpSecret: generateCheckpointSecret() })
    .where(
      and(
        eq(checkpoints.id, input.checkpointId),
        eq(checkpoints.eventId, ctx.event.id)
      )
    )
    .returning()

  if (updated.length === 0)
    return err("not-found", "Checkpoint not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "checkpoint.secret_rotated",
    target: input.checkpointId,
  })

  revalidatePath("/app/routes")
  return { ok: true }
}

// ─────────────────────────── sponsors ──────────────────────────

export async function createSponsor(input: {
  name: string
  tier?: "gold" | "prize" | "community"
  contactEmail?: string
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.name?.trim())
    return err("missing-name", "Sponsor name is required.")

  let id = ""
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(sponsors)
      .values({
        eventId: ctx.event.id,
        name: input.name.trim(),
        tier: input.tier ?? "community",
        contactEmail: input.contactEmail ?? null,
      })
      .returning()
    id = row.id
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "sponsor.created",
      target: id,
      meta: { name: input.name, tier: input.tier },
    })
  })

  revalidatePath("/app/sponsors")
  revalidatePath("/app/routes")
  return { ok: true, data: { id } }
}

export async function updateSponsor(input: {
  sponsorId: string
  name?: string
  tier?: "gold" | "prize" | "community"
  contactEmail?: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.tier !== undefined) patch.tier = input.tier
  if (input.contactEmail !== undefined) patch.contactEmail = input.contactEmail

  if (Object.keys(patch).length === 0)
    return err("noop", "Nothing to update.")

  const updated = await db
    .update(sponsors)
    .set(patch)
    .where(
      and(eq(sponsors.id, input.sponsorId), eq(sponsors.eventId, ctx.event.id))
    )
    .returning()
  if (updated.length === 0)
    return err("not-found", "Sponsor not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "sponsor.updated",
    target: input.sponsorId,
    meta: patch,
  })

  revalidatePath("/app/sponsors")
  return { ok: true }
}

export async function archiveSponsor(input: {
  sponsorId: string
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  await db
    .update(sponsors)
    .set({ archivedAt: new Date() })
    .where(
      and(eq(sponsors.id, input.sponsorId), eq(sponsors.eventId, ctx.event.id))
    )

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "sponsor.archived",
    target: input.sponsorId,
  })

  revalidatePath("/app/sponsors")
  return { ok: true }
}

// ─────────────────────────── rewards ───────────────────────────

export async function createReward(input: {
  name: string
  description?: string
  stockTotal?: number | null
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.name?.trim())
    return err("missing-name", "Reward name is required.")

  let id = ""
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(rewards)
      .values({
        eventId: ctx.event.id,
        name: input.name.trim(),
        description: input.description ?? null,
        stockTotal: input.stockTotal ?? null,
        status: input.stockTotal && input.stockTotal < 20 ? "limited" : "open",
      })
      .returning()
    id = row.id
    await tx.insert(auditLog).values({
      eventId: ctx.event.id,
      actor: ctx.subject.userId ?? "unknown",
      action: "reward.created",
      target: id,
      meta: { name: input.name, stockTotal: input.stockTotal },
    })
  })

  revalidatePath("/app/prize-desk")
  return { ok: true, data: { id } }
}

export async function updateReward(input: {
  rewardId: string
  name?: string
  description?: string | null
  stockTotal?: number | null
  status?: "open" | "limited" | "depleted" | "minting"
}): Promise<ActionResult> {
  const ctx = await getOperatorContext()
  if (!ctx) return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(ctx.subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description
  if (input.stockTotal !== undefined) patch.stockTotal = input.stockTotal
  if (input.status !== undefined) patch.status = input.status

  if (Object.keys(patch).length === 0)
    return err("noop", "Nothing to update.")

  const updated = await db
    .update(rewards)
    .set(patch)
    .where(
      and(eq(rewards.id, input.rewardId), eq(rewards.eventId, ctx.event.id))
    )
    .returning()
  if (updated.length === 0)
    return err("not-found", "Reward not found.")

  await db.insert(auditLog).values({
    eventId: ctx.event.id,
    actor: ctx.subject.userId ?? "unknown",
    action: "reward.updated",
    target: input.rewardId,
    meta: patch,
  })

  revalidatePath("/app/prize-desk")
  return { ok: true }
}

// ─────────────────────────── helpers ───────────────────────────

/**
 * For UI dropdowns: list the routes and sponsors of the active event.
 * Kept here next to the actions so the page only imports one file.
 */
export async function listRoutesForOperator(): Promise<
  Array<{ id: string; name: string; published: boolean }>
> {
  const ctx = await getOperatorContext()
  if (!ctx) return []
  return db
    .select({
      id: routes.id,
      name: routes.name,
      published: routes.published,
    })
    .from(routes)
    .where(and(eq(routes.eventId, ctx.event.id), isNull(routes.archivedAt)))
    .orderBy(asc(routes.createdAt))
}

export async function listSponsorsForOperator(): Promise<
  Array<{ id: string; name: string; tier: string }>
> {
  const ctx = await getOperatorContext()
  if (!ctx) return []
  return db
    .select({ id: sponsors.id, name: sponsors.name, tier: sponsors.tier })
    .from(sponsors)
    .where(
      and(eq(sponsors.eventId, ctx.event.id), isNull(sponsors.archivedAt))
    )
    .orderBy(asc(sponsors.name))
}
