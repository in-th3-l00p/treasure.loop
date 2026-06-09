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
} from "@/db/schema"

/**
 * Read-only queries the operator console uses to render pages.
 *
 * Every function is scoped to an event id. The caller is responsible
 * for resolving the active event (today: the only non-archived event;
 * tomorrow: by Clerk org id).
 */

export async function getActiveEvent() {
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
