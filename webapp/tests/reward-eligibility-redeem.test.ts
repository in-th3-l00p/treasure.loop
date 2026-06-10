import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { and, asc, eq, sql } from "drizzle-orm"
import { getAddress, type Address } from "viem"

import { badgeMints, players, rewards, scans } from "@/db/schema"
import {
  type EligibilityContext,
  evaluateEligibility,
} from "@/lib/reward-eligibility"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * Exercises the server-side eligibility re-check that `redeemReward`
 * performs before decrementing stock. The Server Action itself needs
 * Clerk context, so — as in redemption.test.ts — we replicate its exact
 * DB context-building + the pure `evaluateEligibility` gate against
 * pglite, and confirm an ineligible wallet never decrements stock.
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]

const wallets: Address[] = [
  getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
]

/** Build the same context the Server Action builds for a player. */
async function buildContext(
  playerId: string,
  holdsBadge: boolean
): Promise<EligibilityContext> {
  const minted = await handle.db
    .select({ playerId: badgeMints.playerId })
    .from(badgeMints)
    .innerJoin(players, eq(players.id, badgeMints.playerId))
    .where(eq(players.eventId, eventId))
    .orderBy(asc(badgeMints.mintedAt), asc(badgeMints.id))
  const idx = minted.findIndex((m) => m.playerId === playerId)
  const mintRank = idx === -1 ? null : idx + 1

  const [scanRow] = await handle.db
    .select({ count: sql<number>`count(*)::int` })
    .from(scans)
    .where(eq(scans.playerId, playerId))

  return { holdsBadge, mintRank, scanCount: scanRow?.count ?? 0 }
}

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
    .returning({ id: rewards.id, claimed: rewards.stockClaimed })
}

beforeEach(async () => {
  handle = await newTestDb()
  const seed = await seedTestEvent(handle.db, 5)
  eventId = seed.event.id
  checkpointIds = seed.checkpointIds
})

afterEach(async () => {
  await handle.client.close()
})

describe("redeem eligibility re-check (min-scans rule)", () => {
  it("rejects a wallet under the scan threshold and leaves stock untouched", async () => {
    const [reward] = await handle.db
      .insert(rewards)
      .values({
        eventId,
        name: "Explorer hoodie",
        stockTotal: 5,
        stockClaimed: 0,
        eligibilityRule: { type: "min-scans", n: 3 },
      })
      .returning()

    const [player] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[0] })
      .returning()

    // Only 1 scan — below the required 3.
    await handle.db
      .insert(scans)
      .values({ playerId: player.id, checkpointId: checkpointIds[0] })

    const ctx = await buildContext(player.id, true)
    const verdict = evaluateEligibility(reward.eligibilityRule, ctx)
    expect(verdict.eligible).toBe(false)

    // The action would early-return here; stock must stay at 0.
    const [after] = await handle.db
      .select({ claimed: rewards.stockClaimed })
      .from(rewards)
      .where(eq(rewards.id, reward.id))
    expect(after.claimed).toBe(0)
  })

  it("allows a wallet meeting the scan threshold and decrements once", async () => {
    const [reward] = await handle.db
      .insert(rewards)
      .values({
        eventId,
        name: "Explorer hoodie",
        stockTotal: 5,
        stockClaimed: 0,
        eligibilityRule: { type: "min-scans", n: 3 },
      })
      .returning()

    const [player] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[1] })
      .returning()

    await handle.db.insert(scans).values(
      checkpointIds.slice(0, 4).map((cp) => ({
        playerId: player.id,
        checkpointId: cp,
      }))
    )

    const ctx = await buildContext(player.id, true)
    const verdict = evaluateEligibility(reward.eligibilityRule, ctx)
    expect(verdict.eligible).toBe(true)

    const rows = await atomicallyDecrement(reward.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].claimed).toBe(1)
  })
})

describe("redeem eligibility re-check (first-n-mints rule)", () => {
  it("ranks mints by minted_at and excludes late minters", async () => {
    const [reward] = await handle.db
      .insert(rewards)
      .values({
        eventId,
        name: "Golden ticket",
        stockTotal: 10,
        stockClaimed: 0,
        eligibilityRule: { type: "first-n-mints", n: 1 },
      })
      .returning()

    const playerRows = await handle.db
      .insert(players)
      .values(wallets.map((w) => ({ eventId, wallet: w })))
      .returning()

    // First wallet mints earlier than the second.
    await handle.db.insert(badgeMints).values({
      playerId: playerRows[0].id,
      txHash: `0x${"1".repeat(64)}`,
      mintedAt: new Date("2026-06-10T10:00:00Z"),
    })
    await handle.db.insert(badgeMints).values({
      playerId: playerRows[1].id,
      txHash: `0x${"2".repeat(64)}`,
      mintedAt: new Date("2026-06-10T11:00:00Z"),
    })

    const firstCtx = await buildContext(playerRows[0].id, true)
    const secondCtx = await buildContext(playerRows[1].id, true)

    expect(firstCtx.mintRank).toBe(1)
    expect(secondCtx.mintRank).toBe(2)

    expect(evaluateEligibility(reward.eligibilityRule, firstCtx).eligible).toBe(
      true
    )
    expect(
      evaluateEligibility(reward.eligibilityRule, secondCtx).eligible
    ).toBe(false)
  })
})
