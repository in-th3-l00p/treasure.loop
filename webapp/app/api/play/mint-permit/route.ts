import { NextResponse } from "next/server"

import {
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
  BADGE_CHAIN,
} from "@/lib/badge-contract"
import { issueMintPermit } from "@/lib/mint-permits"
import { getPlayAddress } from "@/lib/play-session"
import {
  hasFinishedLoop,
  playerStore,
  totalCheckpoints,
} from "@/lib/player-store"

/**
 * Issue an EIP-712-signed `MintPermit` for the SIWE-authenticated
 * player iff they have actually finished the loop.
 *
 * On success the response payload is everything the client needs to
 * call `badgeContract.mint(permit, signature)` via wagmi's
 * `useWriteContract`.
 *
 * The endpoint is intentionally non-mutating: it doesn't burn nonces
 * server-side. The contract is the source of truth for "this nonce was
 * used" — if the player submits the same permit twice the second
 * transaction reverts. We do, however, refuse to re-issue a permit
 * once we've observed the badge as minted (cuts down on permit churn).
 */
export async function POST() {
  if (!BADGE_CONTRACT_CONFIGURED) {
    return NextResponse.json(
      {
        error: "contract-not-configured",
        message:
          "NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS is unset — deploy the contract and set it before issuing permits.",
      },
      { status: 503 }
    )
  }

  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }

  const progress = playerStore.get(address)
  if (!progress) {
    return NextResponse.json(
      {
        error: "no-progress",
        message: "Start the loop before requesting a finisher badge.",
      },
      { status: 400 }
    )
  }
  if (!hasFinishedLoop(progress)) {
    return NextResponse.json(
      {
        error: "loop-incomplete",
        message: `Scan all ${totalCheckpoints()} checkpoints before minting.`,
        scanned: progress.scanned.length,
        total: totalCheckpoints(),
      },
      { status: 400 }
    )
  }
  if (progress.badgeMintedAt) {
    return NextResponse.json(
      {
        error: "already-minted",
        message: "This wallet already minted its finisher badge.",
      },
      { status: 409 }
    )
  }

  let issued
  try {
    issued = await issueMintPermit({ player: address })
  } catch (e) {
    const message = e instanceof Error ? e.message : "signer-error"
    return NextResponse.json(
      { error: "signer-unavailable", message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    contract: BADGE_CONTRACT_ADDRESS,
    chainId: BADGE_CHAIN.id,
    permit: {
      player: issued.permit.player,
      chainId: issued.permit.chainId.toString(),
      nonce: issued.permit.nonce,
      deadline: issued.permit.deadline.toString(),
    },
    signature: issued.signature,
  })
}
