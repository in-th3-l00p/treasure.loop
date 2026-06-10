import "server-only"

import { and, count, desc, eq, sql } from "drizzle-orm"

import { db } from "@/db/client"
import {
  auditLog,
  badgeMints,
  checkpoints,
  players,
  redemptionClaims,
  scans,
} from "@/db/schema"
import { shortAddress } from "./format"

/**
 * Read-only queries powering the live ops dashboard (`/app/live`).
 *
 * Style mirrors `lib/event-queries.ts`: every function is scoped to an
 * event id, every number derives from a real table, and quiet windows
 * yield zeros (filled buckets) rather than gaps. Nothing here writes.
 *
 * Kept separate from `event-queries.ts` deliberately — these are the
 * short-window, fast-refreshing reads a polling client hits every few
 * seconds, not the page-load aggregates.
 */

export interface ScanBucket {
  /** `HH:MM` label of the minute bucket (UTC). */
  minute: string
  scans: number
}

/**
 * Scans bucketed by minute over the last `minutes` window, oldest
 * first, empty minutes filled with zero so the trendline keeps a stable
 * width during quiet stretches.
 */
export async function listScansPerMinute(
  eventId: string,
  minutes = 45
): Promise<ScanBucket[]> {
  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('minute', ${scans.createdAt}), 'HH24:MI')`,
      n: sql<number>`count(*)::int`,
    })
    .from(scans)
    .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
    .where(
      and(
        eq(checkpoints.eventId, eventId),
        sql`${scans.createdAt} > now() - (${minutes}::int * interval '1 minute')`
      )
    )
    .groupBy(sql`1`)

  const byMinute = new Map(rows.map((r) => [r.bucket, r.n]))
  const buckets: ScanBucket[] = []
  const now = new Date()
  for (let i = minutes - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60_000)
    const label = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}`
    buckets.push({ minute: label, scans: byMinute.get(label) ?? 0 })
  }
  return buckets
}

export interface RejectRate {
  windowMinutes: number
  accepted: number
  rejected: number
  /** Rejected / (accepted + rejected), 0–100, rounded. 0 when no scans. */
  rate: number
}

/**
 * Error/reject rate over a recent window, read from the audit log:
 * `player.scan_rejected` vs `player.scanned`. The scan route writes a
 * best-effort reject row for every refused scan, so this is the honest
 * floor signal of "are players hitting friction right now."
 */
export async function getRejectRate(
  eventId: string,
  windowMinutes = 15
): Promise<RejectRate> {
  const rows = await db
    .select({
      action: auditLog.action,
      n: sql<number>`count(*)::int`,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.eventId, eventId),
        sql`${auditLog.action} in ('player.scanned', 'player.scan_rejected')`,
        sql`${auditLog.createdAt} > now() - (${windowMinutes}::int * interval '1 minute')`
      )
    )
    .groupBy(auditLog.action)

  let accepted = 0
  let rejected = 0
  for (const r of rows) {
    if (r.action === "player.scanned") accepted = r.n
    else if (r.action === "player.scan_rejected") rejected = r.n
  }
  const total = accepted + rejected
  const rate = total > 0 ? Math.round((rejected / total) * 100) : 0
  return { windowMinutes, accepted, rejected, rate }
}

export interface QueueDepths {
  /** Players who have scanned at least once but haven't minted. */
  inProgress: number
  /** Finishers who minted a badge but haven't redeemed any reward. */
  mintedNotRedeemed: number
  /** Players who minted and redeemed at least one reward. */
  redeemed: number
}

/**
 * Funnel depths across the event: in-progress vs minted-not-redeemed vs
 * redeemed. Each player counts in exactly one bucket (the furthest stage
 * they've reached), so the three sum to "players who have done anything."
 */
export async function getQueueDepths(eventId: string): Promise<QueueDepths> {
  const [{ minted }] = await db
    .select({ minted: count() })
    .from(badgeMints)
    .innerJoin(players, eq(players.id, badgeMints.playerId))
    .where(eq(players.eventId, eventId))

  const [{ redeemed }] = await db
    .select({
      redeemed: sql<number>`count(distinct ${redemptionClaims.playerId})::int`,
    })
    .from(redemptionClaims)
    .innerJoin(players, eq(players.id, redemptionClaims.playerId))
    .where(eq(players.eventId, eventId))

  // Players who have scanned at least once. `last_scan_at` is set on the
  // first successful scan, so it's the cheapest "started moving" signal.
  const [{ scanned }] = await db
    .select({ scanned: count() })
    .from(players)
    .where(
      and(eq(players.eventId, eventId), sql`${players.lastScanAt} is not null`)
    )

  const mintedNotRedeemed = Math.max(0, minted - redeemed)
  const inProgress = Math.max(0, scanned - minted)

  return {
    inProgress,
    mintedNotRedeemed,
    redeemed,
  }
}

export interface ActivityRow {
  id: string
  line: string
  createdAt: Date
}

/**
 * Recent-activity tail straight from the audit log, newest first.
 * Includes rejected scans (with their reason) so the operator sees
 * friction, not just the happy path.
 */
export async function listRecentActivity(
  eventId: string,
  limit = 12
): Promise<ActivityRow[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.eventId, eventId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    line: humaniseLiveAction(r.action, r.meta),
  }))
}

function humaniseLiveAction(action: string, meta: unknown): string {
  const m =
    meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {}
  switch (action) {
    case "player.scanned":
      return `${shortAddress(String(m.wallet ?? ""))} scanned ${
        m.checkpointName ? `"${m.checkpointName}"` : "a checkpoint"
      }`
    case "player.scan_rejected":
      return `Scan rejected (${m.reason ?? "unknown reason"})`
    case "player.minted":
      return `${shortAddress(String(m.wallet ?? ""))} minted a finisher badge`
    case "redeem":
      return `Reward "${m.rewardName ?? "unnamed"}" redeemed`
    default:
      return action.replace(/\./g, " ")
  }
}

export interface LiveOpsSnapshot {
  scansPerMinute: ScanBucket[]
  rejectRate: RejectRate
  queueDepths: QueueDepths
  activity: ActivityRow[]
  /** Total players started (denominator context for the funnel). */
  playersStarted: number
}

/** One shot of everything the live dashboard polls for. */
export async function getLiveOpsSnapshot(
  eventId: string
): Promise<LiveOpsSnapshot> {
  const [scansPerMinute, rejectRate, queueDepths, activity, started] =
    await Promise.all([
      listScansPerMinute(eventId),
      getRejectRate(eventId),
      getQueueDepths(eventId),
      listRecentActivity(eventId),
      db
        .select({ n: count() })
        .from(players)
        .where(eq(players.eventId, eventId)),
    ])

  return {
    scansPerMinute,
    rejectRate,
    queueDepths,
    activity,
    playersStarted: started[0]?.n ?? 0,
  }
}
