import "server-only"

import { type Address, createPublicClient, getAddress, http } from "viem"
import { eq } from "drizzle-orm"

import { db } from "@/db/client"
import { badgeMints, players } from "@/db/schema"
import {
  BADGE_ABI,
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
  MOCK_CHAIN,
} from "./badge-contract"

/**
 * On-chain badge inspection used by the prize desk.
 *
 * The DB tells us "we recorded a mint for this wallet" — the chain
 * tells us "the wallet actually holds the token right now." Prize
 * desk uses on-chain as the source of truth so a server-side
 * rollback (or a wallet that transferred the badge away) can't be
 * exploited at the counter.
 */

const publicClient = createPublicClient({
  chain: BADGE_CHAIN,
  transport: http(),
})

export interface OnchainBadgeStatus {
  configured: boolean
  balance: bigint
  hasMintedFlag: boolean
  holdsBadge: boolean
}

export async function checkOnchainBadge(
  wallet: Address
): Promise<OnchainBadgeStatus> {
  // PoC mock-chain: badge ownership comes from the recorded mints in the
  // database instead of an RPC read, so the prize desk works end-to-end
  // without a deployed contract.
  if (MOCK_CHAIN) {
    const rows = await db
      .select({ id: badgeMints.id })
      .from(badgeMints)
      .innerJoin(players, eq(players.id, badgeMints.playerId))
      .where(eq(players.wallet, getAddress(wallet)))
      .limit(1)
    const holds = rows.length > 0
    return {
      configured: true,
      balance: holds ? BigInt(1) : BigInt(0),
      hasMintedFlag: holds,
      holdsBadge: holds,
    }
  }

  if (!BADGE_CONTRACT_CONFIGURED) {
    return {
      configured: false,
      balance: BigInt(0),
      hasMintedFlag: false,
      holdsBadge: false,
    }
  }

  const [balance, hasMintedFlag] = await Promise.all([
    publicClient.readContract({
      address: BADGE_CONTRACT_ADDRESS,
      abi: BADGE_ABI,
      functionName: "balanceOf",
      args: [wallet],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: BADGE_CONTRACT_ADDRESS,
      abi: BADGE_ABI,
      functionName: "hasMinted",
      args: [wallet],
    }) as Promise<boolean>,
  ])

  return {
    configured: true,
    balance,
    hasMintedFlag,
    holdsBadge: balance > BigInt(0),
  }
}
