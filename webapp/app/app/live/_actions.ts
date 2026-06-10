"use server"

import { getSubject } from "@/lib/auth-server"
import { ROLES, hasRole } from "@/lib/authz"
import { readBadgePauseState, type BadgePauseState } from "@/lib/badge-pause"
import { getActiveEvent } from "@/lib/event-queries"
import { getLiveOpsSnapshot, type LiveOpsSnapshot } from "@/lib/live-ops"

/**
 * Server Actions backing the live ops dashboard. Both are reachable via
 * direct POST, so every one re-checks the organizer role server-side —
 * the UI gate is not the security boundary.
 */

export type LivePollResult =
  | {
      ok: true
      snapshot: LiveOpsSnapshot
      pause: BadgePauseState
      polledAt: string
    }
  | { ok: false; error: "forbidden" | "no-event" }

/**
 * One poll tick: the live snapshot + current on-chain pause state. The
 * client calls this on an interval. Read-only.
 */
export async function pollLiveOps(): Promise<LivePollResult> {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER])) {
    return { ok: false, error: "forbidden" }
  }
  const event = await getActiveEvent(subject.orgId)
  if (!event) return { ok: false, error: "no-event" }

  const [snapshot, pause] = await Promise.all([
    getLiveOpsSnapshot(event.id),
    readBadgePauseState(),
  ])

  return {
    ok: true,
    snapshot,
    pause,
    polledAt: new Date().toISOString(),
  }
}

export type PauseToggleResult =
  | { ok: true; pause: BadgePauseState }
  | { ok: false; error: "forbidden" | "not-supported"; message: string }

/**
 * Attempt to flip the on-chain pause state.
 *
 * Today this is an honest no-op: the webapp holds no contract-owner key
 * and the bundled ABI has no pause write, so there is no safe way to
 * mutate on-chain state from here. We re-read the current state and
 * return a clear `not-supported` so the UI can explain rather than
 * pretend a write happened.
 */
export async function requestPauseToggle(): Promise<PauseToggleResult> {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER])) {
    return {
      ok: false,
      error: "forbidden",
      message: "Only organizers can control minting.",
    }
  }

  const pause = await readBadgePauseState()
  return {
    ok: false,
    error: "not-supported",
    message: pause.detail,
  }
}
