import "server-only"

import { and, eq, sql } from "drizzle-orm"
import { type Address, getAddress } from "viem"

import { db } from "@/db/client"
import { playerFollows, playerProfiles } from "@/db/schema"
import { normalizeHandle } from "@/lib/handle"

/**
 * Player social graph: a wallet follows another wallet.
 *
 * Rows live in `player_follows`, one per `(followerWallet, followingWallet)`
 * pair (unique-indexed). Wallets are stored checksummed to match the rest
 * of the player store, so callers should pass checksummed addresses (the
 * helpers normalize via `getAddress` defensively).
 */

/** Checksum a wallet, or return null if it isn't a valid address. */
function toChecksum(wallet: string): Address | null {
  try {
    return getAddress(wallet)
  } catch {
    return null
  }
}

/**
 * Follow `following` as `follower`. Idempotent: a repeat follow is a no-op
 * (handled by the unique index + `onConflictDoNothing`). A wallet cannot
 * follow itself — that's silently ignored.
 */
export async function follow(
  follower: string,
  following: string
): Promise<void> {
  const followerWallet = toChecksum(follower)
  const followingWallet = toChecksum(following)
  if (!followerWallet || !followingWallet) return
  if (followerWallet === followingWallet) return

  await db
    .insert(playerFollows)
    .values({ followerWallet, followingWallet })
    .onConflictDoNothing({
      target: [playerFollows.followerWallet, playerFollows.followingWallet],
    })
}

/** Unfollow `following` as `follower` (no-op if not currently following). */
export async function unfollow(
  follower: string,
  following: string
): Promise<void> {
  const followerWallet = toChecksum(follower)
  const followingWallet = toChecksum(following)
  if (!followerWallet || !followingWallet) return

  await db
    .delete(playerFollows)
    .where(
      and(
        eq(playerFollows.followerWallet, followerWallet),
        eq(playerFollows.followingWallet, followingWallet)
      )
    )
}

/** Whether `follower` currently follows `following`. */
export async function isFollowing(
  follower: string,
  following: string
): Promise<boolean> {
  const followerWallet = toChecksum(follower)
  const followingWallet = toChecksum(following)
  if (!followerWallet || !followingWallet) return false

  const [row] = await db
    .select({ id: playerFollows.id })
    .from(playerFollows)
    .where(
      and(
        eq(playerFollows.followerWallet, followerWallet),
        eq(playerFollows.followingWallet, followingWallet)
      )
    )
    .limit(1)
  return row !== undefined
}

/** How many wallets follow `wallet`. */
export async function countFollowers(wallet: string): Promise<number> {
  const checksum = toChecksum(wallet)
  if (!checksum) return 0
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerFollows)
    .where(eq(playerFollows.followingWallet, checksum))
  return row?.count ?? 0
}

/** How many wallets `wallet` follows. */
export async function countFollowing(wallet: string): Promise<number> {
  const checksum = toChecksum(wallet)
  if (!checksum) return 0
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerFollows)
    .where(eq(playerFollows.followerWallet, checksum))
  return row?.count ?? 0
}

/**
 * Resolve a public handle to its owning wallet (checksummed), or null if
 * the handle is unknown. A small read kept local to the follow layer so it
 * stays decoupled from the profile module's richer types.
 */
export async function walletForHandle(handle: string): Promise<string | null> {
  const normalized = normalizeHandle(handle)
  if (!normalized) return null
  const [row] = await db
    .select({ wallet: playerProfiles.wallet })
    .from(playerProfiles)
    .where(eq(playerProfiles.handle, normalized))
    .limit(1)
  return row?.wallet ?? null
}
