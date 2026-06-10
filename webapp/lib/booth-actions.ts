"use server"

import { and, desc, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db/client"
import {
  auditLog,
  checkpoints,
  events,
  scans,
  staffAlerts,
  staffAssignments,
} from "@/db/schema"
import { getSubject } from "./auth-server"
import { canIssueScan, hasRole, ROLES } from "./authz"
import { shortAddress } from "./format"

/**
 * Server Actions backing the booth kiosk (Phase 6).
 *
 * Authorization mirrors `lib/event-actions.ts`: every action re-checks
 * policy (defense in depth — middleware already gates the page) and
 * writes an `audit_log` row alongside the mutation.
 *
 * Booth staff act on *their* checkpoint only. We gate by
 * `canIssueScan` (organizer or booth_staff) and, for non-organizers,
 * verify a `staff_assignments` row for this user + checkpoint. Organizers
 * may operate any checkpoint in their event.
 */

type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; message: string }

function err<T = unknown>(error: string, message: string): ActionResult<T> {
  return { ok: false, error, message }
}

/**
 * Resolve the caller, their event, and confirm they may operate the
 * given checkpoint. Returns null with a reason on any failure.
 */
async function getBoothContext(checkpointId: string): Promise<
  | {
      ok: true
      userId: string
      eventId: string
    }
  | { ok: false; error: string; message: string }
> {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId) {
    return { ok: false, error: "forbidden", message: "Sign in as booth staff." }
  }
  if (!canIssueScan(subject)) {
    return { ok: false, error: "forbidden", message: "Booth staff only." }
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, subject.orgId), isNull(events.archivedAt)))
    .limit(1)
  if (!event) {
    return { ok: false, error: "no-event", message: "No active event." }
  }

  // The checkpoint must belong to the caller's event.
  const [cp] = await db
    .select({ id: checkpoints.id })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.eventId, event.id),
        isNull(checkpoints.archivedAt)
      )
    )
    .limit(1)
  if (!cp) {
    return { ok: false, error: "not-found", message: "Checkpoint not found." }
  }

  // Organizers may operate any checkpoint; booth staff need an assignment.
  if (!hasRole(subject, [ROLES.ORGANIZER])) {
    const [assignment] = await db
      .select({ id: staffAssignments.id })
      .from(staffAssignments)
      .where(
        and(
          eq(staffAssignments.checkpointId, checkpointId),
          eq(staffAssignments.userId, subject.userId)
        )
      )
      .limit(1)
    if (!assignment) {
      return {
        ok: false,
        error: "not-assigned",
        message: "You are not assigned to this checkpoint.",
      }
    }
  }

  return { ok: true, userId: subject.userId, eventId: event.id }
}

// ───────────────────────── pause / resume ──────────────────────────

/**
 * Toggle a checkpoint between active (`healthy`) and `offline`. When
 * offline, `/api/play/scan` rejects scans with `checkpoint-offline`.
 */
export async function setCheckpointPaused(input: {
  checkpointId: string
  paused: boolean
}): Promise<ActionResult<{ status: "healthy" | "offline" }>> {
  const ctx = await getBoothContext(input.checkpointId)
  if (!ctx.ok) return err(ctx.error, ctx.message)

  const nextStatus = input.paused ? "offline" : "healthy"

  await db.transaction(async (tx) => {
    await tx
      .update(checkpoints)
      .set({ status: nextStatus })
      .where(
        and(
          eq(checkpoints.id, input.checkpointId),
          eq(checkpoints.eventId, ctx.eventId)
        )
      )
    await tx.insert(auditLog).values({
      eventId: ctx.eventId,
      actor: ctx.userId,
      action: input.paused ? "checkpoint.paused" : "checkpoint.resumed",
      target: input.checkpointId,
      meta: { status: nextStatus },
    })
  })

  revalidatePath(`/app/booth/${input.checkpointId}`)
  revalidatePath("/app")
  return { ok: true, data: { status: nextStatus } }
}

// ───────────────────────────── alerts ──────────────────────────────

/** Raise a "Help me" alert from the kiosk. Idempotent-ish: a second
 * raise while one is still open is allowed (staff may need it twice),
 * but the overview de-duplicates visually by checkpoint. */
export async function raiseStaffAlert(input: {
  checkpointId: string
  message?: string
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await getBoothContext(input.checkpointId)
  if (!ctx.ok) return err(ctx.error, ctx.message)

  const message = input.message?.trim() || null

  let id = ""
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(staffAlerts)
      .values({
        eventId: ctx.eventId,
        checkpointId: input.checkpointId,
        raisedBy: ctx.userId,
        kind: "help",
        message,
      })
      .returning()
    id = row.id
    await tx.insert(auditLog).values({
      eventId: ctx.eventId,
      actor: ctx.userId,
      action: "staff.alert_raised",
      target: input.checkpointId,
      meta: { alertId: id, message },
    })
  })

  revalidatePath("/app")
  return { ok: true, data: { id } }
}

/**
 * Acknowledge an open alert. Organizer-side action from the overview.
 * Anyone who can issue scans in the event may acknowledge (an organizer
 * on the floor, or staff who resolved their own request).
 */
export async function acknowledgeStaffAlert(input: {
  alertId: string
}): Promise<ActionResult> {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId) {
    return err("forbidden", "Sign in to acknowledge alerts.")
  }
  if (!canIssueScan(subject)) {
    return err("forbidden", "Booth staff or organizers only.")
  }

  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, subject.orgId), isNull(events.archivedAt)))
    .limit(1)
  if (!event) return err("no-event", "No active event.")

  const updated = await db
    .update(staffAlerts)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      acknowledgedBy: subject.userId,
    })
    .where(
      and(
        eq(staffAlerts.id, input.alertId),
        eq(staffAlerts.eventId, event.id),
        eq(staffAlerts.status, "open")
      )
    )
    .returning()

  if (updated.length === 0) {
    return err("not-found", "Alert not found or already acknowledged.")
  }

  await db.insert(auditLog).values({
    eventId: event.id,
    actor: subject.userId,
    action: "staff.alert_acknowledged",
    target: updated[0].checkpointId,
    meta: { alertId: input.alertId },
  })

  revalidatePath("/app")
  return { ok: true }
}

// ───────────────────────── recent scans feed ───────────────────────

export interface RecentScan {
  id: string
  wallet: string
  shortWallet: string
  at: number
}

/**
 * The last `limit` scans for a checkpoint, newest first. Powers the
 * kiosk's "Recent" list via client polling. Gated to staff who can
 * operate the checkpoint so it isn't a public wallet feed.
 */
export async function listRecentScans(input: {
  checkpointId: string
  limit?: number
}): Promise<ActionResult<RecentScan[]>> {
  const ctx = await getBoothContext(input.checkpointId)
  if (!ctx.ok) return err(ctx.error, ctx.message)

  const { players } = await import("@/db/schema")
  const rows = await db
    .select({
      id: scans.id,
      wallet: players.wallet,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(players, eq(players.id, scans.playerId))
    .where(eq(scans.checkpointId, input.checkpointId))
    .orderBy(desc(scans.createdAt))
    .limit(input.limit ?? 5)

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      wallet: r.wallet,
      shortWallet: shortAddress(r.wallet),
      at: r.createdAt.getTime(),
    })),
  }
}
