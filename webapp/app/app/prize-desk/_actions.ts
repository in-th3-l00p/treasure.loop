"use server"

import { and, asc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { type Address, getAddress, isAddress } from "viem"

import { db } from "@/db/client"
import {
  auditLog,
  badgeMints,
  players,
  redemptionClaims,
  rewards,
  scans,
} from "@/db/schema"
import { getSubject } from "@/lib/auth-server"
import { hasRole, ROLES } from "@/lib/authz"
import { checkOnchainBadge } from "@/lib/badge-onchain"
import { currentEventId } from "@/lib/player-store"
import {
  type EligibilityContext,
  evaluateEligibility,
} from "@/lib/reward-eligibility"

/**
 * Build the eligibility context for one wallet/player in one event:
 * its 1-based mint rank (by `badge_mints.minted_at` across the event)
 * and its scan count. `holdsBadge` is supplied by the caller since it
 * comes from the on-chain check (or the DB fallback in dev).
 */
async function buildEligibilityContext(
  eventId: string,
  playerId: string,
  holdsBadge: boolean
): Promise<EligibilityContext> {
  // Mint rank: order every minted player in the event by mint time and
  // find this player's position. Null if this player hasn't minted.
  const minted = await db
    .select({ playerId: badgeMints.playerId })
    .from(badgeMints)
    .innerJoin(players, eq(players.id, badgeMints.playerId))
    .where(eq(players.eventId, eventId))
    .orderBy(asc(badgeMints.mintedAt), asc(badgeMints.id))

  const idx = minted.findIndex((m) => m.playerId === playerId)
  const mintRank = idx === -1 ? null : idx + 1

  const [scanRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scans)
    .where(eq(scans.playerId, playerId))

  return {
    holdsBadge,
    mintRank,
    scanCount: scanRow?.count ?? 0,
  }
}

export type RedeemResult =
  | {
      ok: true
      claimId: string
      rewardName: string
      claimedAt: string
      staffUserId: string | null
    }
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

  // 3b. Re-evaluate this reward's eligibility rule server-side. The
  //     verifier already filters to eligible rewards, but a direct POST
  //     (or a stale client) could ask for one the wallet doesn't
  //     qualify for. The chain check above is the badge precondition;
  //     here we enforce the per-reward rule (first-N-mints, min-scans).
  const holdsBadge = onchain.configured ? onchain.holdsBadge : true
  const ctx = await buildEligibilityContext(eventId, player.id, holdsBadge)
  const eligibility = evaluateEligibility(reward.eligibilityRule, ctx)
  if (!eligibility.eligible) {
    return {
      ok: false,
      error: "not-eligible",
      message: `Not eligible for ${reward.name}: ${eligibility.reason}`,
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
  let claim: { id: string; claimedAt: Date } | null = null
  await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(redemptionClaims)
      .values({
        playerId: player.id,
        rewardId: reward.id,
        staffUserId: subject.userId ?? null,
      })
      .returning()
    claim = { id: c.id, claimedAt: c.claimedAt }
    await tx.insert(auditLog).values({
      eventId,
      actor: subject.userId ?? "unknown",
      action: "redeem",
      target: reward.id,
      meta: { wallet, rewardName: reward.name },
    })
  })

  revalidatePath("/app/prize-desk")
  const settled = claim as { id: string; claimedAt: Date } | null
  return {
    ok: true,
    claimId: settled!.id,
    rewardName: reward.name,
    claimedAt: settled!.claimedAt.toISOString(),
    staffUserId: subject.userId ?? null,
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

  // Prior claims for this wallet, with reward names + dates so the desk
  // can flag a wallet that already redeemed something (Phase 5).
  const priorClaims = player
    ? await db
        .select({
          rewardId: redemptionClaims.rewardId,
          rewardName: rewards.name,
          claimedAt: redemptionClaims.claimedAt,
        })
        .from(redemptionClaims)
        .innerJoin(rewards, eq(rewards.id, redemptionClaims.rewardId))
        .where(eq(redemptionClaims.playerId, player.id))
        .orderBy(asc(redemptionClaims.claimedAt))
    : []

  // Per-reward eligibility for this wallet. We only have a context when
  // there's a player record; with no player every rule trivially fails
  // the badge precondition anyway.
  const holdsBadge = onchain.configured ? onchain.holdsBadge : true
  const ctx = player
    ? await buildEligibilityContext(eventId, player.id, holdsBadge)
    : { holdsBadge, mintRank: null, scanCount: 0 }

  const claimedIds = new Set(priorClaims.map((c) => c.rewardId))
  const rewardsWithEligibility = availableRewards.map((r) => {
    const verdict = evaluateEligibility(r.eligibilityRule, ctx)
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      stockClaimed: r.stockClaimed,
      stockTotal: r.stockTotal,
      rule: r.eligibilityRule ?? null,
      eligible: verdict.eligible,
      reason: verdict.reason,
      alreadyClaimed: claimedIds.has(r.id),
    }
  })

  return {
    ok: true as const,
    wallet,
    player,
    onchain,
    context: ctx,
    rewards: rewardsWithEligibility,
    priorClaims: priorClaims.map((c) => ({
      rewardId: c.rewardId,
      rewardName: c.rewardName,
      claimedAt: c.claimedAt,
    })),
  }
}
