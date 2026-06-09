import "server-only"

import { type Address, createPublicClient, http } from "viem"

import {
  BADGE_ABI,
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
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
