import "server-only"

import { and, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db/client"
import {
  checkpoints,
  events,
  rewards,
  routes,
  sponsors,
  staffAssignments,
} from "@/db/schema"
import {
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
} from "./badge-contract"

/**
 * Go/no-go checks for an event. Surfaces the things organizers
 * routinely forget before opening doors.
 */

export type CheckLevel = "ok" | "warn" | "fail"

export interface PreflightCheck {
  id: string
  title: string
  level: CheckLevel
  detail: string
  /** Optional URL the operator can click to fix it. */
  fixHref?: string
}

export interface PreflightReport {
  ready: boolean // true iff no `fail`
  warnings: number
  failures: number
  checks: PreflightCheck[]
}

export async function buildPreflightReport(
  eventId: string
): Promise<PreflightReport> {
  const checks: PreflightCheck[] = []

  // ────── event basics ──────
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) {
    return {
      ready: false,
      warnings: 0,
      failures: 1,
      checks: [
        {
          id: "event-exists",
          title: "Event row exists",
          level: "fail",
          detail: "No event record. Re-authenticate to provision one.",
        },
      ],
    }
  }

  checks.push({
    id: "event-name",
    title: "Event has a name and venue",
    level: event.name && event.venue ? "ok" : "warn",
    detail: event.venue
      ? `${event.name} at ${event.venue}`
      : `${event.name} — missing venue`,
    fixHref: "/app",
  })

  // ────── routes ──────
  const routeRows = await db
    .select()
    .from(routes)
    .where(
      and(eq(routes.eventId, eventId), isNull(routes.archivedAt))
    )
  const publishedRoutes = routeRows.filter((r) => r.published)
  checks.push({
    id: "routes",
    title: "At least one route is published",
    level: publishedRoutes.length > 0 ? "ok" : "fail",
    detail:
      publishedRoutes.length > 0
        ? `${publishedRoutes.length} published, ${routeRows.length - publishedRoutes.length} draft`
        : "No published route — players have nothing to play.",
    fixHref: "/app/routes",
  })

  // ────── checkpoints ──────
  const cpRows = await db
    .select()
    .from(checkpoints)
    .where(
      and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
    )

  checks.push({
    id: "checkpoint-count",
    title: "Has at least 3 checkpoints",
    level:
      cpRows.length >= 3
        ? "ok"
        : cpRows.length > 0
          ? "warn"
          : "fail",
    detail: `${cpRows.length} active checkpoint(s).`,
    fixHref: "/app/routes",
  })

  const missingSecret = cpRows.filter((c) => !c.totpSecret)
  checks.push({
    id: "checkpoint-secrets",
    title: "Every checkpoint has a verification secret",
    level: missingSecret.length === 0 ? "ok" : "fail",
    detail:
      missingSecret.length === 0
        ? "All checkpoints have a TOTP secret."
        : `${missingSecret.length} checkpoint(s) missing a secret. Rotate to generate.`,
    fixHref: "/app/routes",
  })

  const missingSponsor = cpRows.filter((c) => !c.sponsorId)
  checks.push({
    id: "checkpoint-sponsors",
    title: "Every checkpoint has a sponsor assigned",
    level: missingSponsor.length === 0 ? "ok" : "warn",
    detail:
      missingSponsor.length === 0
        ? "All checkpoints have a sponsor."
        : `${missingSponsor.length} unassigned. Checkpoints without a sponsor still work but show "—" in reports.`,
    fixHref: "/app/routes",
  })

  // ────── staff assignments ──────
  const staffCountsByCheckpoint = await db
    .select({
      checkpointId: staffAssignments.checkpointId,
      count: sql<number>`count(*)::int`,
    })
    .from(staffAssignments)
    .innerJoin(
      checkpoints,
      eq(checkpoints.id, staffAssignments.checkpointId)
    )
    .where(eq(checkpoints.eventId, eventId))
    .groupBy(staffAssignments.checkpointId)
  const staffed = new Set(staffCountsByCheckpoint.map((s) => s.checkpointId))
  const unstaffed = cpRows.filter((c) => !staffed.has(c.id))
  checks.push({
    id: "staff-assignments",
    title: "Every checkpoint has at least one staff member",
    level: unstaffed.length === 0 ? "ok" : "warn",
    detail:
      unstaffed.length === 0
        ? "Every checkpoint has a staff assignment."
        : `${unstaffed.length} unstaffed. Use Team → Invite.`,
    fixHref: "/app/team",
  })

  // ────── sponsors ──────
  const sponsorRows = await db
    .select()
    .from(sponsors)
    .where(
      and(eq(sponsors.eventId, eventId), isNull(sponsors.archivedAt))
    )
  checks.push({
    id: "sponsor-count",
    title: "At least one sponsor configured",
    level: sponsorRows.length > 0 ? "ok" : "warn",
    detail:
      sponsorRows.length > 0
        ? `${sponsorRows.length} active.`
        : "No sponsors yet.",
    fixHref: "/app/sponsors",
  })

  // ────── rewards ──────
  const rewardRows = await db
    .select()
    .from(rewards)
    .where(eq(rewards.eventId, eventId))
  checks.push({
    id: "rewards",
    title: "At least one reward defined",
    level: rewardRows.length > 0 ? "ok" : "fail",
    detail:
      rewardRows.length > 0
        ? `${rewardRows.length} reward tier(s) configured.`
        : "Players can finish but get nothing at the prize desk.",
    fixHref: "/app/prize-desk",
  })

  // ────── contract + signer ──────
  checks.push({
    id: "badge-contract",
    title: "Badge contract address configured",
    level: BADGE_CONTRACT_CONFIGURED ? "ok" : "warn",
    detail: BADGE_CONTRACT_CONFIGURED
      ? `${BADGE_CONTRACT_ADDRESS}`
      : "NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS is unset. Set it to enable on-chain badge mints.",
  })

  checks.push({
    id: "badge-signer",
    title: "Mint permit signer key configured",
    level: process.env.BADGE_SIGNER_PRIVATE_KEY ? "ok" : "warn",
    detail: process.env.BADGE_SIGNER_PRIVATE_KEY
      ? "Signer key present."
      : "BADGE_SIGNER_PRIVATE_KEY is unset. The mint API returns 503 without it.",
  })

  // ────── session secret in prod ──────
  if (process.env.NODE_ENV === "production") {
    checks.push({
      id: "play-session-secret",
      title: "Play session cookie encryption key configured",
      level: process.env.PLAY_SESSION_SECRET ? "ok" : "fail",
      detail: process.env.PLAY_SESSION_SECRET
        ? "PLAY_SESSION_SECRET set."
        : "Production must override the dev fallback.",
    })
  }

  const failures = checks.filter((c) => c.level === "fail").length
  const warnings = checks.filter((c) => c.level === "warn").length
  return {
    ready: failures === 0,
    failures,
    warnings,
    checks,
  }
}
