import "server-only"

import { eq, sql } from "drizzle-orm"

import { db } from "@/db/client"
import {
  badgeMints,
  checkpoints,
  players,
  playerProfiles,
  scans,
} from "@/db/schema"

/**
 * Per-event leaderboard — Phase 2 gameplay.
 *
 * Ranks every player in an event by progress through the hunt. A player
 * who has scanned every checkpoint is "finished"; finishers outrank
 * everyone else and are ordered by when they closed the loop (their last
 * scan time), so the earliest finisher is rank 1. Unfinished players
 * follow, ordered by how far they've come (scan count, descending) and
 * then by how early they started.
 *
 * Names/avatars resolve through the global, wallet-keyed `playerProfiles`
 * table (a LEFT JOIN on the checksummed wallet) — a player without a
 * profile simply falls back to a shortened wallet address.
 */

export interface LeaderboardRow {
  rank: number
  wallet: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  scannedCount: number
  total: number
  finished: boolean
  /** Epoch ms of the finisher's last scan, or null if not finished. */
  finishedAt: number | null
  minted: boolean
}

/**
 * Ranked leaderboard rows for an event, best first.
 *
 * `total` is the event's checkpoint count; a player is `finished` only
 * when `scannedCount >= total && total > 0`. `finishedAt` is the player's
 * last scan time (when finished) — that's the close-the-loop moment.
 */
export async function getEventLeaderboard(
  eventId: string,
  limit = 50
): Promise<LeaderboardRow[]> {
  // The event's checkpoint count is the denominator for everyone.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(checkpoints)
    .where(eq(checkpoints.eventId, eventId))

  // One row per player: scan count + last scan time, whether they minted,
  // and any profile fields. `players.lastScanAt` is the close-the-loop
  // timestamp once they're finished.
  const rows = await db
    .select({
      wallet: players.wallet,
      startedAt: players.startedAt,
      lastScanAt: players.lastScanAt,
      handle: playerProfiles.handle,
      displayName: playerProfiles.displayName,
      avatarUrl: playerProfiles.avatarUrl,
      scannedCount: sql<number>`count(distinct ${scans.checkpointId})::int`,
      minted: sql<boolean>`bool_or(${badgeMints.id} is not null)`,
    })
    .from(players)
    .leftJoin(scans, eq(scans.playerId, players.id))
    .leftJoin(badgeMints, eq(badgeMints.playerId, players.id))
    .leftJoin(playerProfiles, eq(playerProfiles.wallet, players.wallet))
    .where(eq(players.eventId, eventId))
    .groupBy(
      players.id,
      players.wallet,
      players.startedAt,
      players.lastScanAt,
      playerProfiles.handle,
      playerProfiles.displayName,
      playerProfiles.avatarUrl
    )

  const ranked = rows
    .map((r) => {
      const scannedCount = r.scannedCount ?? 0
      const finished = total > 0 && scannedCount >= total
      const finishedAt = finished ? (r.lastScanAt?.getTime() ?? null) : null
      return {
        wallet: r.wallet,
        handle: r.handle,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        scannedCount,
        total,
        finished,
        finishedAt,
        minted: r.minted ?? false,
        startedAt: r.startedAt.getTime(),
      }
    })
    .sort((a, b) => {
      // Finishers first, earliest finisher (smallest finishedAt) at rank 1.
      if (a.finished !== b.finished) return a.finished ? -1 : 1
      if (a.finished && b.finished) {
        const af = a.finishedAt ?? Infinity
        const bf = b.finishedAt ?? Infinity
        if (af !== bf) return af - bf
        return a.startedAt - b.startedAt
      }
      // Unfinished: more scans first, then earlier start.
      if (a.scannedCount !== b.scannedCount) {
        return b.scannedCount - a.scannedCount
      }
      return a.startedAt - b.startedAt
    })
    .slice(0, limit)

  return ranked.map((row, i) => ({
    rank: i + 1,
    wallet: row.wallet,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    scannedCount: row.scannedCount,
    total: row.total,
    finished: row.finished,
    finishedAt: row.finishedAt,
    minted: row.minted,
  }))
}
