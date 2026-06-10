import { and, eq } from "drizzle-orm"
import { type Address, getAddress } from "viem"

import { db as defaultDb } from "@/db/client"
import {
  auditLog,
  badgeMints,
  checkpoints,
  fragments,
  leadConsents,
  players,
  redemptionClaims,
  rewards,
  scans,
} from "@/db/schema"

/**
 * GDPR data-rights: export and erasure for the attendee (player) surface.
 *
 * These run on behalf of an authenticated play session — the caller has
 * already proven wallet ownership via SIWE (`getPlayAddress`). Everything
 * here is scoped to a single (wallet, eventId) pair: a player is unique
 * per event (`players.event_wallet` unique index).
 *
 * Erasure policy (Article 17, balanced against immutable on-chain truth):
 *   - DELETE the player's scans and redemption claims — these are the
 *     event-side personal records we control.
 *   - KEEP the `badge_mints` row. The finisher badge is an on-chain NFT
 *     owned by the player's wallet; we cannot (and have no right to) burn
 *     it. The DB row is merely a mirror of that public-chain fact.
 *   - ANONYMIZE the player row in place rather than deleting it, because
 *     `badge_mints.player_id` is a NOT NULL foreign key with ON DELETE
 *     CASCADE — deleting the player would cascade-drop the badge mirror.
 *     We overwrite the stored wallet with a deterministic anonymized
 *     placeholder so the row can no longer be linked back to a person,
 *     while the mint mirror stays intact and queryable as chain truth.
 *
 * Test-injection mirrors `player-store.ts` so tests can pass a pglite db.
 */

type Db = typeof defaultDb

let storeDb: Db = defaultDb

/** Test-only: inject a different Drizzle client (e.g. pglite). */
export function __setDataRightsDb(d: Db) {
  storeDb = d
}

export function __resetDataRightsDb() {
  storeDb = defaultDb
}

export interface PlayerDataExport {
  exportedAt: string
  event: { id: string }
  player: {
    wallet: Address
    startedAt: string
    lastScanAt: string | null
  } | null
  scans: Array<{
    checkpointId: string
    checkpointName: string | null
    scannedAt: string
  }>
  redemptions: Array<{
    rewardId: string
    rewardName: string | null
    notes: string | null
    claimedAt: string
  }>
  badgeMints: Array<{
    txHash: string
    tokenId: number | null
    mintedAt: string
  }>
}

/**
 * Return everything we hold about a player for an event: their record,
 * scans, redemptions, and badge mints — as a plain, serializable object.
 */
export async function exportPlayerData(
  wallet: Address,
  eventId: string
): Promise<PlayerDataExport> {
  const checksum = getAddress(wallet)

  const [player] = await storeDb
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, checksum)))
    .limit(1)

  const base: PlayerDataExport = {
    exportedAt: new Date().toISOString(),
    event: { id: eventId },
    player: null,
    scans: [],
    redemptions: [],
    badgeMints: [],
  }

  if (!player) return base

  base.player = {
    wallet: checksum,
    startedAt: player.startedAt.toISOString(),
    lastScanAt: player.lastScanAt?.toISOString() ?? null,
  }

  const [scanRows, redemptionRows, mintRows] = await Promise.all([
    storeDb
      .select({
        checkpointId: scans.checkpointId,
        checkpointName: checkpoints.name,
        scannedAt: scans.createdAt,
      })
      .from(scans)
      .leftJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
      .where(eq(scans.playerId, player.id))
      .orderBy(scans.createdAt),
    storeDb
      .select({
        rewardId: redemptionClaims.rewardId,
        rewardName: rewards.name,
        notes: redemptionClaims.notes,
        claimedAt: redemptionClaims.claimedAt,
      })
      .from(redemptionClaims)
      .leftJoin(rewards, eq(rewards.id, redemptionClaims.rewardId))
      .where(eq(redemptionClaims.playerId, player.id))
      .orderBy(redemptionClaims.claimedAt),
    storeDb
      .select({
        txHash: badgeMints.txHash,
        tokenId: badgeMints.tokenId,
        mintedAt: badgeMints.mintedAt,
      })
      .from(badgeMints)
      .where(eq(badgeMints.playerId, player.id)),
  ])

  base.scans = scanRows.map((r) => ({
    checkpointId: r.checkpointId,
    checkpointName: r.checkpointName ?? null,
    scannedAt: r.scannedAt.toISOString(),
  }))
  base.redemptions = redemptionRows.map((r) => ({
    rewardId: r.rewardId,
    rewardName: r.rewardName ?? null,
    notes: r.notes ?? null,
    claimedAt: r.claimedAt.toISOString(),
  }))
  base.badgeMints = mintRows.map((r) => ({
    txHash: r.txHash,
    tokenId: r.tokenId ?? null,
    mintedAt: r.mintedAt.toISOString(),
  }))

  return base
}

export interface ErasureResult {
  erased: boolean
  scansDeleted: number
  redemptionsDeleted: number
  leadConsentsDeleted: number
  fragmentsDeleted: number
  badgeMintsKept: number
  /** The anonymized placeholder the wallet was replaced with, if erased. */
  anonymizedWallet: string | null
}

/**
 * Deterministic, non-reversible anonymized placeholder for a wallet.
 * Keeps a valid 0x-prefixed 40-hex shape so the column constraint holds,
 * but carries no link back to the real address. Deterministic so a repeat
 * erasure is idempotent and won't collide with the (event, wallet) unique
 * index across two different real wallets in the same event.
 */
function anonymizedWalletFor(playerId: string): string {
  // playerId is already a random short id; pad/truncate to 40 hex chars.
  const hex = Buffer.from(playerId)
    .toString("hex")
    .padEnd(40, "0")
    .slice(0, 40)
  return `0x${hex}`
}

/**
 * Erase the player's event-side personal data. Deletes scans and
 * redemption claims, anonymizes the player row in place, and keeps the
 * badge_mints mirror (on-chain truth). Idempotent: a second call on an
 * already-anonymized wallet is a no-op returning erased: false.
 */
export async function erasePlayerData(
  wallet: Address,
  eventId: string
): Promise<ErasureResult> {
  const checksum = getAddress(wallet)

  const empty: ErasureResult = {
    erased: false,
    scansDeleted: 0,
    redemptionsDeleted: 0,
    leadConsentsDeleted: 0,
    fragmentsDeleted: 0,
    badgeMintsKept: 0,
    anonymizedWallet: null,
  }

  const [player] = await storeDb
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, checksum)))
    .limit(1)

  if (!player) return empty

  const anonymized = anonymizedWalletFor(player.id)

  return storeDb.transaction(async (tx) => {
    // Bare `.returning()` — drizzle's delete chain only types the
    // no-arg form here; we just need the row count.
    const deletedScans = await tx
      .delete(scans)
      .where(eq(scans.playerId, player.id))
      .returning()

    const deletedRedemptions = await tx
      .delete(redemptionClaims)
      .where(eq(redemptionClaims.playerId, player.id))
      .returning()

    // Lead consents carry the player's real wallet as PII shared with a
    // sponsor — delete them outright. Fragments carry no wallet directly
    // but link back to the player; drop them too.
    const deletedConsents = await tx
      .delete(leadConsents)
      .where(eq(leadConsents.playerId, player.id))
      .returning()

    const deletedFragments = await tx
      .delete(fragments)
      .where(eq(fragments.playerId, player.id))
      .returning()

    const keptMints = await tx
      .select({ id: badgeMints.id })
      .from(badgeMints)
      .where(eq(badgeMints.playerId, player.id))

    // Anonymize the player row in place (preserves the badge_mints FK).
    await tx
      .update(players)
      .set({ wallet: anonymized, lastScanAt: null })
      .where(eq(players.id, player.id))

    // Best-effort audit row. We log the anonymized wallet, never the real
    // one, so the audit trail itself doesn't re-introduce the PII.
    await tx.insert(auditLog).values({
      eventId,
      actor: anonymized,
      action: "player.erased",
      target: player.id,
      meta: {
        scansDeleted: deletedScans.length,
        redemptionsDeleted: deletedRedemptions.length,
        leadConsentsDeleted: deletedConsents.length,
        fragmentsDeleted: deletedFragments.length,
        badgeMintsKept: keptMints.length,
      },
    })

    return {
      erased: true,
      scansDeleted: deletedScans.length,
      redemptionsDeleted: deletedRedemptions.length,
      leadConsentsDeleted: deletedConsents.length,
      fragmentsDeleted: deletedFragments.length,
      badgeMintsKept: keptMints.length,
      anonymizedWallet: anonymized,
    }
  })
}
