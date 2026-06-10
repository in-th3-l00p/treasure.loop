import "server-only"

import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db/client"
import {
  badgeMints,
  checkpoints,
  events,
  players,
  redemptionClaims,
  rewards,
  scans,
  sponsors,
  staffAssignments,
} from "@/db/schema"
import { getSubject } from "./auth-server"

/**
 * Read-only queries the operator console uses to render pages.
 *
 * Every function is scoped to an event id. The caller is responsible
 * for resolving the active event (today: the only non-archived event;
 * tomorrow: by Clerk org id).
 */

/**
 * Returns the active event.
 *
 * If `orgId` is provided we scope to that Clerk org (the operator
 * console path). Otherwise we resolve the current Clerk org from
 * the request's auth context; if that's missing we fall back to the
 * most-recently-created non-archived event (single-event dev mode
 * and the attendee surface).
 */
export async function getActiveEvent(orgId?: string | null) {
  let resolvedOrgId = orgId
  if (resolvedOrgId === undefined) {
    const subject = await getSubject()
    resolvedOrgId = subject.orgId
  }
  if (resolvedOrgId) {
    const [scoped] = await db
      .select()
      .from(events)
      .where(and(eq(events.orgId, resolvedOrgId), isNull(events.archivedAt)))
      .limit(1)
    if (scoped) return scoped
  }
  const [event] = await db
    .select()
    .from(events)
    .where(isNull(events.archivedAt))
    .orderBy(desc(events.createdAt))
    .limit(1)
  return event ?? null
}

export interface CheckpointRow {
  id: string
  name: string
  area: string | null
  routeId: string
  sponsorId: string | null
  sponsorName: string | null
  sponsorTier: string | null
  scans: number
  completion: number
  status: "healthy" | "busy" | "needs_staff" | "offline"
  staff: string | null
  clue: string | null
  clueType: "scan" | "staff" | "pair" | "nfc"
  orderIndex: number
}

/**
 * Checkpoint list with derived metrics: total scans, completion %
 * (scans / total active players), staff name, sponsor name.
 */
export async function listCheckpoints(
  eventId: string
): Promise<CheckpointRow[]> {
  const [{ total: totalPlayers }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(players)
    .where(eq(players.eventId, eventId))

  const rows = await db
    .select({
      id: checkpoints.id,
      name: checkpoints.name,
      area: checkpoints.area,
      routeId: checkpoints.routeId,
      sponsorId: checkpoints.sponsorId,
      sponsorName: sponsors.name,
      sponsorTier: sponsors.tier,
      status: checkpoints.status,
      clue: checkpoints.clue,
      clueType: checkpoints.clueType,
      orderIndex: checkpoints.orderIndex,
      scanCount: sql<number>`(select count(*)::int from ${scans} where ${scans.checkpointId} = ${checkpoints.id})`,
    })
    .from(checkpoints)
    .leftJoin(sponsors, eq(sponsors.id, checkpoints.sponsorId))
    .where(
      and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
    )
    .orderBy(asc(checkpoints.orderIndex))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    area: r.area,
    routeId: r.routeId,
    sponsorId: r.sponsorId,
    sponsorName: r.sponsorName,
    sponsorTier: r.sponsorTier,
    scans: r.scanCount,
    completion:
      totalPlayers > 0
        ? Math.round((r.scanCount / totalPlayers) * 100)
        : 0,
    status: r.status,
    staff: null, // TODO: join staff_assignments once Phase 2 wires invites
    clue: r.clue,
    clueType: r.clueType,
    orderIndex: r.orderIndex,
  }))
}

export interface SponsorRow {
  id: string
  name: string
  tier: "gold" | "prize" | "community"
  visits: number
  conversations: number
}

export async function listSponsors(eventId: string): Promise<SponsorRow[]> {
  const rows = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      tier: sponsors.tier,
      visits: sql<number>`(
        select count(*)::int from ${scans} s
        join ${checkpoints} cp on cp.id = s.${checkpoints.id}
        where cp.${checkpoints.sponsorId} = ${sponsors.id}
      )`,
    })
    .from(sponsors)
    .where(
      and(eq(sponsors.eventId, eventId), isNull(sponsors.archivedAt))
    )
    .orderBy(asc(sponsors.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tier: r.tier,
    visits: r.visits,
    // Conversations = sponsors' interpretation of "deep visit." For now
    // proxy = visits at this sponsor where the player also scanned the
    // next checkpoint within 10min — close enough until we have a
    // proper opt-in tag. Returning 0 until Phase 8 builds it for real.
    conversations: 0,
  }))
}

export interface OverviewKpis {
  activePlayers: number
  routeCompletion: number
  sponsorVisits: number
  badgeMints: number
  completions: number
}

export async function getOverviewKpis(
  eventId: string
): Promise<OverviewKpis> {
  const [
    [{ players: activePlayers }],
    [{ visits: sponsorVisits }],
    [{ mints: badgeMintCount }],
  ] = await Promise.all([
    db
      .select({ players: count() })
      .from(players)
      .where(eq(players.eventId, eventId)),
    db
      .select({ visits: count() })
      .from(scans)
      .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
      .where(eq(checkpoints.eventId, eventId)),
    db
      .select({ mints: count() })
      .from(badgeMints)
      .innerJoin(players, eq(players.id, badgeMints.playerId))
      .where(eq(players.eventId, eventId)),
  ])

  const total = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(checkpoints)
    .where(
      and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
    )
  const totalCp = total[0].n

  // Completion % = (scans / players) / totalCheckpoints, rounded.
  const routeCompletion =
    totalCp > 0 && activePlayers > 0
      ? Math.round((sponsorVisits / (totalCp * activePlayers)) * 100)
      : 0

  return {
    activePlayers,
    sponsorVisits,
    badgeMints: badgeMintCount,
    completions: badgeMintCount, // mint == completion proof
    routeCompletion,
  }
}

export interface HourlyBucket {
  hour: string
  scans: number
  completions: number
}

/**
 * Real scan/mint counts bucketed by hour, oldest first. Empty buckets
 * are filled so the chart keeps a stable rhythm during quiet hours.
 * `sponsorId` narrows scans to one sponsor's checkpoints.
 */
export async function listHourlyTraffic(
  eventId: string,
  opts: { hours?: number; sponsorId?: string } = {}
): Promise<HourlyBucket[]> {
  const hours = opts.hours ?? 8

  const scanRows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('hour', ${scans.createdAt}), 'HH24:00')`,
      n: sql<number>`count(*)::int`,
    })
    .from(scans)
    .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
    .where(
      and(
        eq(checkpoints.eventId, eventId),
        opts.sponsorId ? eq(checkpoints.sponsorId, opts.sponsorId) : undefined,
        sql`${scans.createdAt} > now() - (${hours}::int * interval '1 hour')`
      )
    )
    .groupBy(sql`1`)

  const mintRows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('hour', ${badgeMints.mintedAt}), 'HH24:00')`,
      n: sql<number>`count(*)::int`,
    })
    .from(badgeMints)
    .innerJoin(players, eq(players.id, badgeMints.playerId))
    .where(
      and(
        eq(players.eventId, eventId),
        sql`${badgeMints.mintedAt} > now() - (${hours}::int * interval '1 hour')`
      )
    )
    .groupBy(sql`1`)

  const scansBy = new Map(scanRows.map((r) => [r.bucket, r.n]))
  const mintsBy = new Map(mintRows.map((r) => [r.bucket, r.n]))

  const buckets: HourlyBucket[] = []
  const now = new Date()
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3_600_000)
    const label = `${String(d.getUTCHours()).padStart(2, "0")}:00`
    buckets.push({
      hour: label,
      scans: scansBy.get(label) ?? 0,
      completions: mintsBy.get(label) ?? 0,
    })
  }
  return buckets
}

/** Staff assignments per checkpoint (user ids; names live in Clerk). */
export async function listStaffByCheckpoint(
  eventId: string
): Promise<Map<string, { userId: string; isPrimary: boolean }[]>> {
  const rows = await db
    .select({
      checkpointId: staffAssignments.checkpointId,
      userId: staffAssignments.userId,
      isPrimary: staffAssignments.isPrimary,
    })
    .from(staffAssignments)
    .innerJoin(checkpoints, eq(checkpoints.id, staffAssignments.checkpointId))
    .where(eq(checkpoints.eventId, eventId))

  const byCheckpoint = new Map<string, { userId: string; isPrimary: boolean }[]>()
  for (const r of rows) {
    const list = byCheckpoint.get(r.checkpointId) ?? []
    list.push({ userId: r.userId, isPrimary: r.isPrimary })
    byCheckpoint.set(r.checkpointId, list)
  }
  return byCheckpoint
}

/** Player records the operator sees in the verification queue. */
export async function listVerificationQueue(eventId: string) {
  const rows = await db
    .select({
      playerId: players.id,
      address: players.wallet,
      startedAt: players.startedAt,
      lastScanAt: players.lastScanAt,
      mintedAt: badgeMints.mintedAt,
      txHash: badgeMints.txHash,
    })
    .from(players)
    .leftJoin(badgeMints, eq(badgeMints.playerId, players.id))
    .where(eq(players.eventId, eventId))
    .orderBy(desc(players.lastScanAt))
    .limit(20)
  return rows
}

/** Recent redemptions for the prize-desk feed. */
export async function listRecentRedemptions(eventId: string, limit = 8) {
  const rows = await db
    .select({
      id: redemptionClaims.id,
      claimedAt: redemptionClaims.claimedAt,
      rewardName: rewards.name,
      wallet: players.wallet,
      staffUserId: redemptionClaims.staffUserId,
    })
    .from(redemptionClaims)
    .innerJoin(rewards, eq(rewards.id, redemptionClaims.rewardId))
    .innerJoin(players, eq(players.id, redemptionClaims.playerId))
    .where(eq(rewards.eventId, eventId))
    .orderBy(desc(redemptionClaims.claimedAt))
    .limit(limit)
  return rows
}

export async function listRewards(eventId: string) {
  return db
    .select()
    .from(rewards)
    .where(eq(rewards.eventId, eventId))
    .orderBy(asc(rewards.name))
}

/**
 * Pull the most recent audit_log entries for the event and turn them
 * into one-line activity strings. The shape matches the static mock
 * the overview page used to hard-code, so the UI doesn't have to
 * change.
 */
export async function listLiveActivity(
  eventId: string,
  limit = 6
): Promise<{ id: string; line: string; createdAt: Date }[]> {
  const { auditLog } = await import("@/db/schema")
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.eventId, eventId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    line: humaniseAction(r.action, r.meta),
  }))
}

function humaniseAction(action: string, meta: unknown): string {
  const m = (meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {})
  switch (action) {
    case "event.created":
      return `Event created (${m.orgName ?? "unnamed"})`
    case "event.archived":
      return "Event archived"
    case "route.created":
      return `Route “${m.name ?? "unnamed"}” created`
    case "route.published":
      return "Route published"
    case "route.unpublished":
      return "Route unpublished"
    case "route.renamed":
      return `Route renamed to “${m.name ?? "unnamed"}”`
    case "route.archived":
      return "Route archived"
    case "checkpoint.created":
      return `Checkpoint “${m.name ?? "unnamed"}” added`
    case "checkpoint.updated":
      return "Checkpoint updated"
    case "checkpoint.archived":
      return "Checkpoint archived"
    case "checkpoint.reordered":
      return "Checkpoint order updated"
    case "checkpoint.secret_rotated":
      return "Checkpoint secret rotated"
    case "sponsor.created":
      return `Sponsor “${m.name ?? "unnamed"}” added`
    case "sponsor.updated":
      return "Sponsor updated"
    case "sponsor.archived":
      return "Sponsor archived"
    case "reward.created":
      return `Reward “${m.name ?? "unnamed"}” added`
    case "reward.updated":
      return "Reward updated"
    case "staff.invited":
      return `Staff invited (${m.role ?? "role unknown"})`
    case "staff.assigned":
      return "Staff assigned to checkpoint"
    case "staff.unassigned":
      return "Staff unassigned"
    case "redeem":
      return `Reward “${m.rewardName ?? "unnamed"}” redeemed`
    default:
      return action.replace(/\./g, " ")
  }
}
