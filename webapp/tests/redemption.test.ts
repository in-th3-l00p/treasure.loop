import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { and, eq, sql } from "drizzle-orm"
import { getAddress, type Address } from "viem"

import { players, redemptionClaims, rewards } from "@/db/schema"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * The redemption Server Action's most important property is that two
 * concurrent staff members can't oversell a limited-stock reward.
 * These tests exercise the atomic decrement directly against pglite —
 * we don't import the Server Action (it needs Clerk auth context),
 * but we replicate its exact SQL shape.
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let rewardId: string
let playerIds: string[]

const wallets: Address[] = [
  getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
  getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
]

beforeEach(async () => {
  handle = await newTestDb()
  const seed = await seedTestEvent(handle.db, 5)
  eventId = seed.event.id

  const [reward] = await handle.db
    .insert(rewards)
    .values({
      eventId,
      name: "Speaker dinner pass",
      stockTotal: 2,
      stockClaimed: 0,
    })
    .returning()
  rewardId = reward.id

  const playerRows = await handle.db
    .insert(players)
    .values(wallets.map((w) => ({ eventId, wallet: w })))
    .returning()
  playerIds = playerRows.map((p) => p.id)
})

afterEach(async () => {
  await handle.client.close()
})

/**
 * The Server Action's atomic decrement is:
 *   UPDATE rewards
 *      SET stock_claimed = stock_claimed + 1
 *    WHERE id = ?
 *      AND (stock_total IS NULL OR stock_claimed < stock_total)
 *   RETURNING *;
 *
 * If the WHERE clause filters the row out, Postgres returns 0 rows
 * and the caller knows to surface "out of stock."
 */
async function atomicallyDecrement(rId: string) {
  return handle.db
    .update(rewards)
    .set({ stockClaimed: sql`${rewards.stockClaimed} + 1` })
    .where(
      and(
        eq(rewards.id, rId),
        sql`(${rewards.stockTotal} IS NULL OR ${rewards.stockClaimed} < ${rewards.stockTotal})`
      )
    )
    .returning({
      id: rewards.id,
      claimed: rewards.stockClaimed,
      total: rewards.stockTotal,
    })
}

describe("atomic stock decrement", () => {
  it("first claim succeeds, claimed=1", async () => {
    const rows = await atomicallyDecrement(rewardId)
    expect(rows).toHaveLength(1)
    expect(rows[0].claimed).toBe(1)
  })

  it("the cap-th claim succeeds, the (cap+1)-th fails", async () => {
    await atomicallyDecrement(rewardId) // claimed = 1
    await atomicallyDecrement(rewardId) // claimed = 2 (cap reached)
    const third = await atomicallyDecrement(rewardId) // exceeds cap
    expect(third).toHaveLength(0)
  })

  it("a NULL-stock (unlimited) reward never depletes", async () => {
    const [unlimited] = await handle.db
      .insert(rewards)
      .values({
        eventId,
        name: "On-chain badge",
        stockTotal: null,
        stockClaimed: 0,
      })
      .returning()
    for (let i = 0; i < 50; i++) {
      const rows = await atomicallyDecrement(unlimited.id)
      expect(rows).toHaveLength(1)
    }
  })

  it("concurrent attempts beyond the cap fail safely", async () => {
    // Reset to a single-unit reward.
    await handle.db
      .update(rewards)
      .set({ stockTotal: 1, stockClaimed: 0 })
      .where(eq(rewards.id, rewardId))

    // Fire 10 concurrent decrements; only one should win.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => atomicallyDecrement(rewardId))
    )
    const winners = results.filter((r) => r.length === 1)
    expect(winners).toHaveLength(1)
    expect(winners[0][0].claimed).toBe(1)
  })
})

describe("redemption uniqueness", () => {
  it("a wallet can only claim a specific reward once", async () => {
    // First claim succeeds.
    await handle.db.insert(redemptionClaims).values({
      playerId: playerIds[0],
      rewardId,
    })
    // Second insert violates the unique index.
    await expect(
      handle.db.insert(redemptionClaims).values({
        playerId: playerIds[0],
        rewardId,
      })
    ).rejects.toThrow()
  })

  it("two different wallets can each claim the same reward", async () => {
    await handle.db.insert(redemptionClaims).values({
      playerId: playerIds[0],
      rewardId,
    })
    await handle.db.insert(redemptionClaims).values({
      playerId: playerIds[1],
      rewardId,
    })
    const rows = await handle.db
      .select()
      .from(redemptionClaims)
      .where(eq(redemptionClaims.rewardId, rewardId))
    expect(rows).toHaveLength(2)
  })
})
