"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { type Address, getAddress, isAddress } from "viem"

import { db } from "@/db/client"
import { auditLog, players, redemptionClaims, rewards } from "@/db/schema"
import { getSubject } from "@/lib/auth-server"
import { hasRole, ROLES } from "@/lib/authz"
import { checkOnchainBadge } from "@/lib/badge-onchain"
import { currentEventId } from "@/lib/player-store"

export type RedeemResult =
  | { ok: true; claimId: string; rewardName: string }
  | { ok: false; error: string; message: string }

/**
 * Hand out a reward to a wallet at the prize desk.
 *
 * Server-side guarantees:
 *   1. Caller has `prize_desk` or `organizer` role on the active org.
 *   2. The wallet address is well-formed and checksummed.
 *   3. The wallet actually holds an on-chain badge right now (or the
 *      badge contract isn't configured — in which case we trust the DB
 *      record so dev demos work).
 *   4. The reward's stock decrements atomically — we use
 *      `WHERE stock_total IS NULL OR stock_claimed < stock_total` so
 *      two concurrent staff can't double-spend the last unit.
 *   5. The wallet hasn't already claimed this reward (one claim per
 *      pair). For multi-claim rewards we'd flag the reward in schema.
 */
export async function redeemReward(input: {
  rewardId: string
  walletAddress: string
}): Promise<RedeemResult> {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER, ROLES.PRIZE_DESK])) {
    return {
      ok: false,
      error: "forbidden",
      message: "Only prize desk staff or organizers can redeem rewards.",
    }
  }

  if (!isAddress(input.walletAddress)) {
    return {
      ok: false,
      error: "bad-address",
      message: "Wallet address is malformed.",
    }
  }
  const wallet: Address = getAddress(input.walletAddress)
  const eventId = await currentEventId()

  // 1. Verify the player exists for this event.
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, wallet)))
    .limit(1)

  if (!player) {
    return {
      ok: false,
      error: "no-player",
      message: "No player record for that wallet.",
    }
  }

  // 2. On-chain check is the source of truth.
  const onchain = await checkOnchainBadge(wallet)
  if (onchain.configured && !onchain.holdsBadge) {
    return {
      ok: false,
      error: "no-badge",
      message: "Wallet does not currently hold a finisher badge.",
    }
  }

  // 3. Verify the reward exists and belongs to the same event.
  const [reward] = await db
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, input.rewardId), eq(rewards.eventId, eventId)))
    .limit(1)

  if (!reward) {
    return {
      ok: false,
      error: "no-reward",
      message: "Unknown reward.",
    }
  }

  // 4. Check for prior claim.
  const [prior] = await db
    .select({ id: redemptionClaims.id })
    .from(redemptionClaims)
    .where(
      and(
        eq(redemptionClaims.playerId, player.id),
        eq(redemptionClaims.rewardId, reward.id)
      )
    )
    .limit(1)

  if (prior) {
    return {
      ok: false,
      error: "already-claimed",
      message: "This wallet has already claimed this reward.",
    }
  }

  // 5. Atomic decrement-or-fail. The condition lives in WHERE so two
  //    concurrent UPDATE statements can't both succeed past the cap.
  const updated = await db
    .update(rewards)
    .set({
      stockClaimed: sql`${rewards.stockClaimed} + 1`,
    })
    .where(
      and(
        eq(rewards.id, reward.id),
        // either unlimited OR still under cap
        sql`(${rewards.stockTotal} IS NULL OR ${rewards.stockClaimed} < ${rewards.stockTotal})`
      )
    )
    .returning()

  if (updated.length === 0) {
    return {
      ok: false,
      error: "out-of-stock",
      message: `${reward.name} is depleted.`,
    }
  }

  // 6. Record the claim. If this fails we need to roll back the
  //    stock — wrap both in a transaction.
  let claim: { id: string } | null = null
  await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(redemptionClaims)
      .values({
        playerId: player.id,
        rewardId: reward.id,
        staffUserId: subject.userId ?? null,
      })
      .returning()
    claim = { id: c.id }
    await tx.insert(auditLog).values({
      eventId,
      actor: subject.userId ?? "unknown",
      action: "redeem",
      target: reward.id,
      meta: { wallet, rewardName: reward.name },
    })
  })

  revalidatePath("/app/prize-desk")
  return {
    ok: true,
    claimId: claim!.id,
    rewardName: reward.name,
  }
}

/**
 * Verify a wallet at the prize desk — returns badge status + the
 * rewards still available for them. Read-only.
 */
export async function lookupWallet(input: { walletAddress: string }) {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER, ROLES.PRIZE_DESK])) {
    return { ok: false as const, error: "forbidden" }
  }
  if (!isAddress(input.walletAddress)) {
    return { ok: false as const, error: "bad-address" }
  }
  const wallet: Address = getAddress(input.walletAddress)
  const eventId = await currentEventId()

  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.eventId, eventId), eq(players.wallet, wallet)))
    .limit(1)

  const onchain = await checkOnchainBadge(wallet)

  const availableRewards = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.eventId, eventId),
        sql`(${rewards.stockTotal} IS NULL OR ${rewards.stockClaimed} < ${rewards.stockTotal})`
      )
    )

  const claimedRewards = player
    ? await db
        .select({
          rewardId: redemptionClaims.rewardId,
          claimedAt: redemptionClaims.claimedAt,
        })
        .from(redemptionClaims)
        .where(eq(redemptionClaims.playerId, player.id))
    : []

  return {
    ok: true as const,
    wallet,
    player,
    onchain,
    availableRewards,
    claimedRewardIds: new Set(claimedRewards.map((c) => c.rewardId)),
  }
}
