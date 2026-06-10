import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getAddress, type Address } from "viem"
import { and, eq } from "drizzle-orm"

import {
  __resetDataRightsDb,
  __setDataRightsDb,
  erasePlayerData,
  exportPlayerData,
} from "@/lib/data-rights"
import {
  __resetStoreDb,
  __setStoreDb,
  recordBadgeMint,
  recordScan,
} from "@/lib/player-store"

import {
  auditLog,
  badgeMints,
  players,
  redemptionClaims,
  rewards,
  scans,
} from "@/db/schema"

import { newTestDb, seedTestEvent } from "./db-utils"

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]

const WALLET: Address = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
const OTHER: Address = getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")

/** Seed a finished player: all scans, a redemption, and a badge mint. */
async function seedFinishedPlayer(wallet: Address) {
  for (const id of checkpointIds) {
    await recordScan({ eventId, wallet, checkpointId: id })
  }
  await recordBadgeMint({
    eventId,
    wallet,
    txHash: "0x" + "a".repeat(64),
    tokenId: 7,
  })

  const [player] = await handle.db
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, wallet)))
    .limit(1)

  const [reward] = await handle.db
    .insert(rewards)
    .values({ eventId, name: "Sticker pack" })
    .returning()

  await handle.db.insert(redemptionClaims).values({
    playerId: player.id,
    rewardId: reward.id,
    staffUserId: "user_staff_1",
    notes: "handed over at desk",
  })

  return { playerId: player.id }
}

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db as unknown as never)
  __setDataRightsDb(handle.db as unknown as never)
  const seeded = await seedTestEvent(handle.db, 3)
  eventId = seeded.event.id
  checkpointIds = seeded.checkpointIds
})

afterEach(async () => {
  __resetStoreDb()
  __resetDataRightsDb()
  await handle.client.close()
})

describe("exportPlayerData", () => {
  it("returns null player for someone who never played", async () => {
    const data = await exportPlayerData(WALLET, eventId)
    expect(data.player).toBeNull()
    expect(data.scans).toEqual([])
    expect(data.redemptions).toEqual([])
    expect(data.badgeMints).toEqual([])
    expect(data.event.id).toBe(eventId)
  })

  it("returns scans, redemptions, and badge mints for a finished player", async () => {
    await seedFinishedPlayer(WALLET)

    const data = await exportPlayerData(WALLET, eventId)
    expect(data.player?.wallet).toBe(WALLET)
    expect(data.scans).toHaveLength(3)
    expect(data.scans[0].checkpointName).toMatch(/Checkpoint/)
    expect(data.redemptions).toHaveLength(1)
    expect(data.redemptions[0].rewardName).toBe("Sticker pack")
    expect(data.badgeMints).toHaveLength(1)
    expect(data.badgeMints[0].tokenId).toBe(7)
  })

  it("is a plain JSON-serializable object", async () => {
    await seedFinishedPlayer(WALLET)
    const data = await exportPlayerData(WALLET, eventId)
    expect(() => JSON.stringify(data)).not.toThrow()
    expect(JSON.parse(JSON.stringify(data)).scans).toHaveLength(3)
  })

  it("scopes to the requesting wallet only", async () => {
    await seedFinishedPlayer(WALLET)
    const data = await exportPlayerData(OTHER, eventId)
    expect(data.player).toBeNull()
  })
})

describe("erasePlayerData", () => {
  it("deletes scans and redemptions, keeps the badge mint", async () => {
    const { playerId } = await seedFinishedPlayer(WALLET)

    const result = await erasePlayerData(WALLET, eventId)
    expect(result.erased).toBe(true)
    expect(result.scansDeleted).toBe(3)
    expect(result.redemptionsDeleted).toBe(1)
    expect(result.badgeMintsKept).toBe(1)

    const remainingScans = await handle.db
      .select()
      .from(scans)
      .where(eq(scans.playerId, playerId))
    expect(remainingScans).toHaveLength(0)

    const remainingRedemptions = await handle.db
      .select()
      .from(redemptionClaims)
      .where(eq(redemptionClaims.playerId, playerId))
    expect(remainingRedemptions).toHaveLength(0)

    // Badge mint survives — on-chain truth.
    const mints = await handle.db
      .select()
      .from(badgeMints)
      .where(eq(badgeMints.playerId, playerId))
    expect(mints).toHaveLength(1)
  })

  it("anonymizes the wallet so the player is no longer linkable", async () => {
    const { playerId } = await seedFinishedPlayer(WALLET)
    const result = await erasePlayerData(WALLET, eventId)

    const [player] = await handle.db
      .select()
      .from(players)
      .where(eq(players.id, playerId))

    expect(player.wallet).toBe(result.anonymizedWallet)
    expect(player.wallet).not.toBe(WALLET)
    // Original wallet no longer resolves to any player.
    const byOriginal = await handle.db
      .select()
      .from(players)
      .where(and(eq(players.eventId, eventId), eq(players.wallet, WALLET)))
    expect(byOriginal).toHaveLength(0)
  })

  it("writes a best-effort audit_log row with anonymized actor", async () => {
    await seedFinishedPlayer(WALLET)
    const result = await erasePlayerData(WALLET, eventId)

    const rows = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.erased"))
    expect(rows).toHaveLength(1)
    expect(rows[0].actor).toBe(result.anonymizedWallet)
    // The audit trail must not re-introduce the real wallet.
    expect(rows[0].actor).not.toBe(WALLET)
  })

  it("is a no-op for a wallet that never played", async () => {
    const result = await erasePlayerData(OTHER, eventId)
    expect(result.erased).toBe(false)
    expect(result.scansDeleted).toBe(0)
  })

  it("is idempotent: a second erasure finds nothing left", async () => {
    await seedFinishedPlayer(WALLET)
    await erasePlayerData(WALLET, eventId)
    const second = await erasePlayerData(WALLET, eventId)
    expect(second.erased).toBe(false)
  })
})
