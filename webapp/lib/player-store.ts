import { and, eq, isNull, sql } from "drizzle-orm"
import { type Address, getAddress } from "viem"

import { db as defaultDb } from "@/db/client"
import {
  auditLog,
  badgeMints,
  checkpoints,
  events,
  players,
  scans,
  sponsors,
} from "@/db/schema"

/**
 * Player progress, persistent.
 *
 * `playerStore` exposes the same interface tests and route handlers
 * already use, but every read and write hits Postgres via Drizzle.
 *
 * Scoping
 * ───────
 * Most operations need an `eventId`. We accept it explicitly rather
 * than reaching for "the active event" because:
 *   - the play API resolves the event from the request URL / cookie
 *     (TODO: today there's only one event; for multi-event support
 *     the play landing carries the slug)
 *   - tests pin a specific event id
 *
 * For now the API routes look up the single non-archived event and
 * pass that. `currentEventId()` centralizes that lookup.
 */

type Db = typeof defaultDb

let storeDb: Db = defaultDb

/** Test-only: inject a different Drizzle client (e.g. pglite). */
export function __setStoreDb(d: Db) {
  storeDb = d
}

export function __resetStoreDb() {
  storeDb = defaultDb
}

/** Returns the id of the only live event, or throws. */
export async function currentEventId(): Promise<string> {
  const rows = await storeDb
    .select({ id: events.id })
    .from(events)
    .where(isNull(events.archivedAt))
    .limit(1)
  if (rows.length === 0) {
    throw new Error(
      "No active event. Seed the database (`npm run db:seed`) before serving traffic."
    )
  }
  return rows[0].id
}

export interface PublicCheckpoint {
  id: string
  name: string
  area: string | null
  sponsor: string | null
  clue: string | null
  clueType: "scan" | "staff" | "pair" | "nfc"
  orderIndex: number
}

export interface PublicEventInfo {
  name: string
  venue: string | null
  network: string
  checkpoints: PublicCheckpoint[]
}

/**
 * The event sheet the attendee surface renders: name, network, and the
 * ordered checkpoint list with clues. Never includes TOTP secrets.
 */
export async function getPublicEvent(
  eventId: string
): Promise<PublicEventInfo | null> {
  const [event] = await storeDb
    .select({
      name: events.name,
      venue: events.venue,
      network: events.network,
    })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.archivedAt)))
    .limit(1)
  if (!event) return null

  const rows = await storeDb
    .select({
      id: checkpoints.id,
      name: checkpoints.name,
      area: checkpoints.area,
      sponsor: sponsors.name,
      clue: checkpoints.clue,
      clueType: checkpoints.clueType,
      orderIndex: checkpoints.orderIndex,
    })
    .from(checkpoints)
    .leftJoin(sponsors, eq(sponsors.id, checkpoints.sponsorId))
    .where(
      and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
    )
    .orderBy(checkpoints.orderIndex)

  return { ...event, checkpoints: rows }
}

export interface PublicProgress {
  address: Address
  scanned: string[]
  total: number
  finished: boolean
  badgeMintedAt: number | null
  startedAt: number
  lastScanAt: number | null
}

/** Idempotently get or create a player record. */
export async function ensurePlayer(
  eventId: string,
  wallet: Address
): Promise<{ id: string; wallet: Address; startedAt: number; lastScanAt: number | null }> {
  const checksum = getAddress(wallet)
  await storeDb
    .insert(players)
    .values({ eventId, wallet: checksum })
    .onConflictDoNothing({
      target: [players.eventId, players.wallet],
    })

  const [row] = await storeDb
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, checksum)))
    .limit(1)

  return {
    id: row.id,
    wallet: checksum,
    startedAt: row.startedAt.getTime(),
    lastScanAt: row.lastScanAt?.getTime() ?? null,
  }
}

/** Returns the total number of checkpoints for the event. */
export async function totalCheckpoints(eventId: string): Promise<number> {
  const [{ n }] = await storeDb
    .select({ n: sql<number>`count(*)::int` })
    .from(checkpoints)
    .where(
      and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
    )
  return Number(n)
}

/** Returns true if the given checkpoint id exists in the event. */
export async function isValidCheckpoint(
  eventId: string,
  checkpointId: string
): Promise<boolean> {
  if (!checkpointId) return false
  const [row] = await storeDb
    .select({ id: checkpoints.id })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.eventId, eventId),
        isNull(checkpoints.archivedAt)
      )
    )
    .limit(1)
  return !!row
}

/** Internal: load the scanned checkpoint ids for a player. */
async function loadScans(playerId: string): Promise<string[]> {
  const rows = await storeDb
    .select({ id: scans.checkpointId, t: scans.createdAt })
    .from(scans)
    .where(eq(scans.playerId, playerId))
    .orderBy(scans.createdAt)
  return rows.map((r) => r.id)
}

async function loadBadgeMintedAt(playerId: string): Promise<number | null> {
  const [row] = await storeDb
    .select({ at: badgeMints.mintedAt })
    .from(badgeMints)
    .where(eq(badgeMints.playerId, playerId))
    .limit(1)
  return row?.at?.getTime() ?? null
}

/** Get the player's progress, or null if they haven't started. */
export async function getProgress(
  eventId: string,
  wallet: Address
): Promise<PublicProgress | null> {
  const checksum = getAddress(wallet)
  const [row] = await storeDb
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, checksum)))
    .limit(1)
  if (!row) return null
  const [scannedList, mintedAt, total] = await Promise.all([
    loadScans(row.id),
    loadBadgeMintedAt(row.id),
    totalCheckpoints(eventId),
  ])
  return {
    address: checksum,
    scanned: scannedList,
    total,
    finished: scannedList.length >= total && total > 0,
    badgeMintedAt: mintedAt,
    startedAt: row.startedAt.getTime(),
    lastScanAt: row.lastScanAt?.getTime() ?? null,
  }
}

/** Record a scan. Idempotent on the (player, checkpoint) pair. */
export async function recordScan(opts: {
  eventId: string
  wallet: Address
  checkpointId: string
}): Promise<PublicProgress | null> {
  if (!(await isValidCheckpoint(opts.eventId, opts.checkpointId))) {
    return null
  }
  const player = await ensurePlayer(opts.eventId, opts.wallet)
  const inserted = await storeDb
    .insert(scans)
    .values({
      playerId: player.id,
      checkpointId: opts.checkpointId,
    })
    .onConflictDoNothing({
      target: [scans.playerId, scans.checkpointId],
    })
    .returning()

  if (inserted.length > 0) {
    const [cp] = await storeDb
      .select({ name: checkpoints.name })
      .from(checkpoints)
      .where(eq(checkpoints.id, opts.checkpointId))
      .limit(1)
    await storeDb.insert(auditLog).values({
      eventId: opts.eventId,
      actor: player.wallet,
      action: "player.scanned",
      target: opts.checkpointId,
      meta: { wallet: player.wallet, checkpointName: cp?.name ?? null },
    })
  }

  await storeDb
    .update(players)
    .set({ lastScanAt: new Date() })
    .where(eq(players.id, player.id))
  return getProgress(opts.eventId, opts.wallet)
}

/** Persist a successful mint. Returns null on double-mint or no progress. */
export async function recordBadgeMint(opts: {
  eventId: string
  wallet: Address
  txHash: string
  tokenId?: number
}): Promise<PublicProgress | null> {
  const player = await ensurePlayer(opts.eventId, opts.wallet)
  const progress = await getProgress(opts.eventId, opts.wallet)
  if (!progress) return null
  if (!progress.finished) return null
  if (progress.badgeMintedAt) return null

  try {
    await storeDb.insert(badgeMints).values({
      playerId: player.id,
      txHash: opts.txHash,
      tokenId: opts.tokenId ?? null,
    })
    await storeDb.insert(auditLog).values({
      eventId: opts.eventId,
      actor: player.wallet,
      action: "player.minted",
      target: opts.txHash,
      meta: { wallet: player.wallet, tokenId: opts.tokenId ?? null },
    })
  } catch {
    // unique constraint hit → someone else recorded it first; reload.
  }
  return getProgress(opts.eventId, opts.wallet)
}
