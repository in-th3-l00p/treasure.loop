"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth, clerkClient } from "@clerk/nextjs/server"

import { db } from "@/db/client"
import { auditLog, checkpoints, staffAssignments } from "@/db/schema"

import { getSubject } from "./auth-server"
import {
  type Role,
  ROLES,
  hasRole,
  isRole,
} from "./authz"

type Result<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; message: string }

function err(error: string, message: string): Result {
  return { ok: false, error, message }
}

/**
 * Invite a teammate to the organizer's Clerk org and assign them a
 * role. Optionally pin them to a specific checkpoint (booth_staff,
 * primary or backup).
 *
 * This action wraps `clerkClient.organizations.createOrganizationInvitation`
 * and writes a corresponding `staff_assignments` row on accept (via
 * the Clerk org-membership webhook in production).
 */
export async function inviteStaff(input: {
  email: string
  role: Role
  /** Optional. If provided, also pin to this checkpoint on accept. */
  checkpointId?: string
  isPrimary?: boolean
}): Promise<Result<{ invitationId: string }>> {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId)
    return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")
  if (!input.email || !input.email.includes("@"))
    return err("bad-email", "Provide a valid email address.")
  if (!isRole(input.role))
    return err("bad-role", "Unknown role.")

  const { userId } = await auth()
  if (!userId) return err("forbidden", "Sign in as an organizer.")

  let invitationId: string
  try {
    const client = await clerkClient()
    const invitation =
      await client.organizations.createOrganizationInvitation({
        organizationId: subject.orgId,
        emailAddress: input.email,
        inviterUserId: userId,
        role: input.role,
        publicMetadata: input.checkpointId
          ? {
              checkpointId: input.checkpointId,
              isPrimary: !!input.isPrimary,
            }
          : {},
      })
    invitationId = invitation.id
  } catch (e) {
    return err(
      "clerk-error",
      e instanceof Error ? e.message : "Failed to send invitation."
    )
  }

  await db.insert(auditLog).values({
    actor: subject.userId,
    action: "staff.invited",
    target: invitationId,
    meta: {
      email: input.email,
      role: input.role,
      checkpointId: input.checkpointId ?? null,
    },
  })

  revalidatePath("/app/team")
  return { ok: true, data: { invitationId } }
}

/**
 * Assign an already-joined user to a checkpoint. Used by the role
 * editor for booth staff who joined via invitation without a
 * checkpoint pinned, or for organizers reassigning staff mid-event.
 */
export async function assignStaffToCheckpoint(input: {
  userId: string
  checkpointId: string
  isPrimary?: boolean
}): Promise<Result> {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId)
    return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  // Validate that the checkpoint belongs to the active event.
  const [cp] = await db
    .select({ id: checkpoints.id, eventId: checkpoints.eventId })
    .from(checkpoints)
    .where(eq(checkpoints.id, input.checkpointId))
    .limit(1)
  if (!cp) return err("not-found", "Checkpoint not found.")

  await db
    .insert(staffAssignments)
    .values({
      checkpointId: input.checkpointId,
      userId: input.userId,
      isPrimary: !!input.isPrimary,
      role: "booth_staff",
    })
    .onConflictDoUpdate({
      target: [staffAssignments.checkpointId, staffAssignments.userId],
      set: { isPrimary: !!input.isPrimary },
    })

  await db.insert(auditLog).values({
    eventId: cp.eventId,
    actor: subject.userId,
    action: "staff.assigned",
    target: input.checkpointId,
    meta: { userId: input.userId, isPrimary: !!input.isPrimary },
  })

  revalidatePath("/app/team")
  revalidatePath("/app/routes")
  return { ok: true }
}

export async function unassignStaffFromCheckpoint(input: {
  userId: string
  checkpointId: string
}): Promise<Result> {
  const subject = await getSubject()
  if (!subject.userId || !subject.orgId)
    return err("forbidden", "Sign in as an organizer.")
  if (!hasRole(subject, [ROLES.ORGANIZER]))
    return err("forbidden", "Organizers only.")

  await db
    .delete(staffAssignments)
    .where(
      and(
        eq(staffAssignments.userId, input.userId),
        eq(staffAssignments.checkpointId, input.checkpointId)
      )
    )

  await db.insert(auditLog).values({
    actor: subject.userId,
    action: "staff.unassigned",
    target: input.checkpointId,
    meta: { userId: input.userId },
  })

  revalidatePath("/app/team")
  revalidatePath("/app/routes")
  return { ok: true }
}
