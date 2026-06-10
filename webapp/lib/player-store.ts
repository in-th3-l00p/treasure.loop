import { and, eq, isNull, sql } from "drizzle-orm"
import { type Address, getAddress } from "viem"

import { db as defaultDb } from "@/db/client"
import {
  auditLog,
  badgeMints,
  checkpoints,
  events,
  fragments,
  leadConsents,
  players,
  scans,
  sponsors,
} from "@/db/schema"
import { generateShortCode, normalizeShortCode } from "@/lib/fragments"

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

/**
 * Returns true if the checkpoint exists in the event and is currently
 * paused (`status = 'offline'`). Booth staff toggle this from the kiosk;
 * the scan path uses it to reject scans at a closed booth.
 */
export async function isCheckpointOffline(
  eventId: string,
  checkpointId: string
): Promise<boolean> {
  if (!checkpointId) return false
  const [row] = await storeDb
    .select({ status: checkpoints.status })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.eventId, eventId),
        isNull(checkpoints.archivedAt)
      )
    )
    .limit(1)
  return row?.status === "offline"
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

/** Record a scan. Idempotent on the (player, checkpoint) pair.
 *
 * `shareLead` is the player's privacy-first opt-in ("Share my wallet
 * with this sponsor"). When true AND the checkpoint is sponsor-backed,
 * we record a `lead_consents` row best-effort inside the same
 * transaction. It defaults off and a withheld consent never affects the
 * scan — the player scans normally either way.
 */
export async function recordScan(opts: {
  eventId: string
  wallet: Address
  checkpointId: string
  shareLead?: boolean
}): Promise<PublicProgress | null> {
  if (!(await isValidCheckpoint(opts.eventId, opts.checkpointId))) {
    return null
  }
  // A paused booth records nothing. The route handler also rejects with a
  // clear `checkpoint-offline` error + audit row, but we double-check here
  // so any other caller can't slip a scan past a closed checkpoint.
  if (await isCheckpointOffline(opts.eventId, opts.checkpointId)) {
    return null
  }
  const player = await ensurePlayer(opts.eventId, opts.wallet)
  let inserted: { id: string }[] = []
  await storeDb.transaction(async (tx) => {
    inserted = await tx
      .insert(scans)
      .values({
        playerId: player.id,
        checkpointId: opts.checkpointId,
      })
      .onConflictDoNothing({
        target: [scans.playerId, scans.checkpointId],
      })
      // No column args: drizzle's onConflictDoNothing chain only types the
      // bare form. We only check `length` to detect a genuinely new row.
      .returning()

    if (inserted.length > 0) {
      const [cp] = await tx
        .select({
          name: checkpoints.name,
          sponsorId: checkpoints.sponsorId,
        })
        .from(checkpoints)
        .where(
          and(
            eq(checkpoints.id, opts.checkpointId),
            isNull(checkpoints.archivedAt)
          )
        )
        .limit(1)
      await tx.insert(auditLog).values({
        eventId: opts.eventId,
        actor: player.wallet,
        action: "player.scanned",
        target: opts.checkpointId,
        meta: { wallet: player.wallet, checkpointName: cp?.name ?? null },
      })

      // Privacy-first lead capture: only when the player explicitly opted
      // in AND the checkpoint is sponsor-backed. Idempotent per
      // (player, sponsor); a withheld consent records nothing.
      if (opts.shareLead && cp?.sponsorId) {
        await tx
          .insert(leadConsents)
          .values({
            eventId: opts.eventId,
            playerId: player.id,
            checkpointId: opts.checkpointId,
            sponsorId: cp.sponsorId,
            wallet: player.wallet,
          })
          .onConflictDoNothing({
            target: [leadConsents.playerId, leadConsents.sponsorId],
          })
      }
    }

    await tx
      .update(players)
      .set({ lastScanAt: new Date() })
      .where(eq(players.id, player.id))
  })

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
    await storeDb.transaction(async (tx) => {
      await tx.insert(badgeMints).values({
        playerId: player.id,
        txHash: opts.txHash,
        tokenId: opts.tokenId ?? null,
      })
      await tx.insert(auditLog).values({
        eventId: opts.eventId,
        actor: player.wallet,
        action: "player.minted",
        target: opts.txHash,
        meta: { wallet: player.wallet, tokenId: opts.tokenId ?? null },
      })
    })
  } catch {
    // unique constraint hit → someone else recorded it first; reload.
  }
  return getProgress(opts.eventId, opts.wallet)
}

// ───────────────────────── pair fragments ──────────────────────────
//
// ROADMAP Phase 7. A checkpoint with `clue_type = 'pair'` doesn't complete
// on scan. Instead each player is issued one fragment (kind A or B) with a
// short code; two players with complementary kinds combine to grant the
// checkpoint to BOTH wallets. See `lib/fragments.ts` for the code alphabet.

export type FragmentKind = "A" | "B"

export interface PlayerFragment {
  checkpointId: string
  checkpointName: string
  kind: FragmentKind
  shortCode: string
  paired: boolean
  pairedAt: number | null
}

/** Returns the checkpoint's clue type, or null if it doesn't exist here. */
export async function getCheckpointClueType(
  eventId: string,
  checkpointId: string
): Promise<PublicCheckpoint["clueType"] | null> {
  if (!checkpointId) return null
  const [row] = await storeDb
    .select({ clueType: checkpoints.clueType })
    .from(checkpoints)
    .where(
      and(
        eq(checkpoints.id, checkpointId),
        eq(checkpoints.eventId, eventId),
        isNull(checkpoints.archivedAt)
      )
    )
    .limit(1)
  return row?.clueType ?? null
}

/**
 * Balancing rule (deterministic — no randomness):
 *
 * Count the OUTSTANDING (unpaired) fragments of each kind already issued
 * for this checkpoint. If unpaired A's outnumber B's by ≥3 we must issue
 * B (and vice-versa) to drain the surplus; otherwise we alternate by the
 * current total so the queue stays balanced — an even total issues A, an
 * odd total issues B. This keeps a roughly 50/50 split of pairable kinds
 * without ever calling Math.random.
 */
export function pickFragmentKind(opts: {
  unpairedA: number
  unpairedB: number
}): FragmentKind {
  const { unpairedA, unpairedB } = opts
  if (unpairedA - unpairedB >= 3) return "B"
  if (unpairedB - unpairedA >= 3) return "A"
  // Alternate by total issued (paired + unpaired is not needed here; the
  // unpaired total is what's waiting to be matched). Even → A, odd → B.
  return (unpairedA + unpairedB) % 2 === 0 ? "A" : "B"
}

function toPlayerFragment(row: {
  checkpointId: string
  checkpointName: string
  fragmentKind: FragmentKind
  shortCode: string
  pairedAt: Date | null
}): PlayerFragment {
  return {
    checkpointId: row.checkpointId,
    checkpointName: row.checkpointName,
    kind: row.fragmentKind,
    shortCode: row.shortCode,
    paired: row.pairedAt !== null,
    pairedAt: row.pairedAt?.getTime() ?? null,
  }
}

/** Read the player's fragment for a specific pair checkpoint, if any. */
export async function getPlayerFragmentForCheckpoint(
  eventId: string,
  wallet: Address,
  checkpointId: string
): Promise<PlayerFragment | null> {
  const checksum = getAddress(wallet)
  const [row] = await storeDb
    .select({
      checkpointId: fragments.checkpointId,
      checkpointName: checkpoints.name,
      fragmentKind: fragments.fragmentKind,
      shortCode: fragments.shortCode,
      pairedAt: fragments.pairedAt,
    })
    .from(fragments)
    .innerJoin(players, eq(players.id, fragments.playerId))
    .innerJoin(checkpoints, eq(checkpoints.id, fragments.checkpointId))
    .where(
      and(
        eq(fragments.eventId, eventId),
        eq(fragments.checkpointId, checkpointId),
        eq(players.wallet, checksum)
      )
    )
    .limit(1)
  return row ? toPlayerFragment(row) : null
}

/**
 * The player's current fragment to act on: the most recently issued one
 * that's still unpaired, falling back to the most recent overall (so an
 * already-paired player still sees their resolved state). Drives the
 * `/play/pair` screen.
 */
export async function getPlayerActiveFragment(
  eventId: string,
  wallet: Address
): Promise<PlayerFragment | null> {
  const checksum = getAddress(wallet)
  const rows = await storeDb
    .select({
      checkpointId: fragments.checkpointId,
      checkpointName: checkpoints.name,
      fragmentKind: fragments.fragmentKind,
      shortCode: fragments.shortCode,
      pairedAt: fragments.pairedAt,
      createdAt: fragments.createdAt,
    })
    .from(fragments)
    .innerJoin(players, eq(players.id, fragments.playerId))
    .innerJoin(checkpoints, eq(checkpoints.id, fragments.checkpointId))
    .where(and(eq(fragments.eventId, eventId), eq(players.wallet, checksum)))
    .orderBy(fragments.createdAt)
  if (rows.length === 0) return null
  const unpaired = rows.filter((r) => r.pairedAt === null)
  const pick = unpaired.length > 0 ? unpaired[unpaired.length - 1] : rows[rows.length - 1]
  return toPlayerFragment(pick)
}

/**
 * Issue (or return the existing) fragment for a player at a pair
 * checkpoint. Idempotent on (player, checkpoint): a re-scan returns the
 * same fragment, never a second one. Returns null if the checkpoint isn't
 * a valid, non-offline pair checkpoint in this event.
 */
export async function issueFragment(opts: {
  eventId: string
  wallet: Address
  checkpointId: string
}): Promise<PlayerFragment | null> {
  if (await getCheckpointClueType(opts.eventId, opts.checkpointId) !== "pair") {
    return null
  }
  if (await isCheckpointOffline(opts.eventId, opts.checkpointId)) {
    return null
  }
  const player = await ensurePlayer(opts.eventId, opts.wallet)

  // Idempotent fast path: already issued.
  const existing = await getPlayerFragmentForCheckpoint(
    opts.eventId,
    opts.wallet,
    opts.checkpointId
  )
  if (existing) return existing

  const [cp] = await storeDb
    .select({ name: checkpoints.name })
    .from(checkpoints)
    .where(eq(checkpoints.id, opts.checkpointId))
    .limit(1)

  // Retry a few times so a (rare) short-code collision or a concurrent
  // first-scan race resolves cleanly. The unique (player, checkpoint)
  // index makes the issuance itself idempotent under races.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Balance on the *current* outstanding counts for this checkpoint.
    const counts = await storeDb
      .select({
        kind: fragments.fragmentKind,
        n: sql<number>`count(*)::int`,
      })
      .from(fragments)
      .where(
        and(
          eq(fragments.checkpointId, opts.checkpointId),
          isNull(fragments.pairedAt)
        )
      )
      .groupBy(fragments.fragmentKind)
    const unpairedA = Number(counts.find((c) => c.kind === "A")?.n ?? 0)
    const unpairedB = Number(counts.find((c) => c.kind === "B")?.n ?? 0)
    const kind = pickFragmentKind({ unpairedA, unpairedB })
    const shortCode = generateShortCode()

    const inserted = await storeDb
      .insert(fragments)
      .values({
        eventId: opts.eventId,
        playerId: player.id,
        checkpointId: opts.checkpointId,
        fragmentKind: kind,
        shortCode,
      })
      .onConflictDoNothing()
      // Bare returning: drizzle's onConflictDoNothing chain only types the
      // no-arg form. We only read `length` to detect a genuinely new row.
      .returning()

    if (inserted.length === 0) {
      // A unique index fired: either this player already has a fragment
      // (concurrent first-scan) or the short code collided. Re-read by
      // player first; if present, that's the idempotent answer.
      const now = await getPlayerFragmentForCheckpoint(
        opts.eventId,
        opts.wallet,
        opts.checkpointId
      )
      if (now) return now
      continue // code collision — try a fresh code
    }

    await storeDb.insert(auditLog).values({
      eventId: opts.eventId,
      actor: player.wallet,
      action: "player.fragment_issued",
      target: opts.checkpointId,
      meta: {
        wallet: player.wallet,
        checkpointName: cp?.name ?? null,
        kind,
        shortCode,
      },
    })

    return {
      checkpointId: opts.checkpointId,
      checkpointName: cp?.name ?? "",
      kind,
      shortCode,
      paired: false,
      pairedAt: null,
    }
  }

  // Exhausted retries (astronomically unlikely). Return whatever exists.
  return getPlayerFragmentForCheckpoint(
    opts.eventId,
    opts.wallet,
    opts.checkpointId
  )
}

export type PairRejection =
  | "no-fragment"
  | "unknown-code"
  | "same-player"
  | "not-complementary"
  | "already-paired"

export interface PairSuccess {
  ok: true
  checkpointId: string
  checkpointName: string
}

export interface PairFailure {
  ok: false
  reason: PairRejection
}

/**
 * Combine the caller's fragment with the one identified by `enteredCode`.
 *
 * Validation: the two fragments must belong to the SAME checkpoint, be
 * OPPOSITE kinds (A vs B), belong to two DIFFERENT players, and neither
 * may already be paired. On success we mark both fragments paired and
 * record the checkpoint scan for BOTH wallets through the normal
 * `recordScan` path, so both players' progress + audit rows update.
 */
export async function combineFragments(opts: {
  eventId: string
  wallet: Address
  enteredCode: string
}): Promise<PairSuccess | PairFailure> {
  const callerChecksum = getAddress(opts.wallet)
  const code = normalizeShortCode(opts.enteredCode)

  // The caller's own unpaired fragment is the one we're combining.
  const [mine] = await storeDb
    .select({
      id: fragments.id,
      checkpointId: fragments.checkpointId,
      kind: fragments.fragmentKind,
      playerId: fragments.playerId,
      pairedAt: fragments.pairedAt,
      wallet: players.wallet,
    })
    .from(fragments)
    .innerJoin(players, eq(players.id, fragments.playerId))
    .where(
      and(
        eq(fragments.eventId, opts.eventId),
        eq(players.wallet, callerChecksum),
        isNull(fragments.pairedAt)
      )
    )
    .orderBy(fragments.createdAt)
    .limit(1)

  if (!mine) {
    // Either no fragment at all, or the only one is already paired.
    const any = await getPlayerActiveFragment(opts.eventId, callerChecksum)
    return { ok: false, reason: any?.paired ? "already-paired" : "no-fragment" }
  }

  // Resolve the entered code WITHIN the caller's checkpoint — codes are
  // unique per (event, checkpoint), so this is an exact match.
  const [theirs] = await storeDb
    .select({
      id: fragments.id,
      checkpointId: fragments.checkpointId,
      checkpointName: checkpoints.name,
      kind: fragments.fragmentKind,
      playerId: fragments.playerId,
      pairedAt: fragments.pairedAt,
      wallet: players.wallet,
    })
    .from(fragments)
    .innerJoin(players, eq(players.id, fragments.playerId))
    .innerJoin(checkpoints, eq(checkpoints.id, fragments.checkpointId))
    .where(
      and(
        eq(fragments.eventId, opts.eventId),
        eq(fragments.checkpointId, mine.checkpointId),
        eq(fragments.shortCode, code)
      )
    )
    .limit(1)

  if (!theirs) return { ok: false, reason: "unknown-code" }
  if (theirs.playerId === mine.playerId) {
    return { ok: false, reason: "same-player" }
  }
  if (theirs.pairedAt !== null) return { ok: false, reason: "already-paired" }
  if (theirs.kind === mine.kind) {
    return { ok: false, reason: "not-complementary" }
  }

  const now = new Date()
  // Mark both fragments paired, guarding against a concurrent pairing by
  // requiring they're still unpaired at write time.
  const updatedMine = await storeDb
    .update(fragments)
    .set({ pairedWithPlayerId: theirs.playerId, pairedAt: now })
    .where(and(eq(fragments.id, mine.id), isNull(fragments.pairedAt)))
    .returning()
  if (updatedMine.length === 0) {
    return { ok: false, reason: "already-paired" }
  }
  const updatedTheirs = await storeDb
    .update(fragments)
    .set({ pairedWithPlayerId: mine.playerId, pairedAt: now })
    .where(and(eq(fragments.id, theirs.id), isNull(fragments.pairedAt)))
    .returning()
  if (updatedTheirs.length === 0) {
    // Their side got paired between our read and write — roll mine back.
    await storeDb
      .update(fragments)
      .set({ pairedWithPlayerId: null, pairedAt: null })
      .where(eq(fragments.id, mine.id))
    return { ok: false, reason: "already-paired" }
  }

  // Grant the checkpoint to BOTH wallets via the normal scan path so
  // progress + per-player audit rows update exactly as a solo scan would.
  await recordScan({
    eventId: opts.eventId,
    wallet: callerChecksum as Address,
    checkpointId: mine.checkpointId,
  })
  await recordScan({
    eventId: opts.eventId,
    wallet: theirs.wallet as Address,
    checkpointId: mine.checkpointId,
  })

  await storeDb.insert(auditLog).values({
    eventId: opts.eventId,
    actor: callerChecksum,
    action: "player.fragment_paired",
    target: mine.checkpointId,
    meta: {
      checkpointName: theirs.checkpointName,
      walletA: mine.wallet,
      walletB: theirs.wallet,
    },
  })

  return {
    ok: true,
    checkpointId: mine.checkpointId,
    checkpointName: theirs.checkpointName,
  }
}

/**
 * Record a player's "report suspected cheating" flag from the pair screen
 * for human review at the prize desk. Best-effort audit row only.
 */
export async function reportPairCheating(opts: {
  eventId: string
  wallet: Address
  enteredCode?: string
  note?: string
}): Promise<void> {
  const checksum = getAddress(opts.wallet)
  const active = await getPlayerActiveFragment(opts.eventId, checksum)
  await storeDb.insert(auditLog).values({
    eventId: opts.eventId,
    actor: checksum,
    action: "player.pair_cheating_reported",
    target: active?.checkpointId ?? null,
    meta: {
      wallet: checksum,
      checkpointName: active?.checkpointName ?? null,
      enteredCode: opts.enteredCode
        ? normalizeShortCode(opts.enteredCode)
        : null,
      note: opts.note ?? null,
    },
  })
}
