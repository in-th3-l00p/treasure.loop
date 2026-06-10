import { NextResponse } from "next/server"

import {
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
} from "@/lib/badge-contract"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { increment, Metric } from "@/lib/metrics"
import { issueMintPermit } from "@/lib/mint-permits"
import { getPlayAddress } from "@/lib/play-session"
import {
  currentEventId,
  getProgress,
  totalCheckpoints,
} from "@/lib/player-store"

/**
 * Issue an EIP-712-signed `MintPermit` for the SIWE-authenticated
 * player iff they have actually finished the loop.
 */
export const POST = withRouteLogging(
  "play/mint-permit",
  async (_req: Request, ctx: RouteContext) => {
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
  ctx.set({ actor: address })

  const eventId = await currentEventId()
  const progress = await getProgress(eventId, address)
  if (!progress) {
    return NextResponse.json(
      {
        error: "no-progress",
        message: "Start the loop before requesting a finisher badge.",
      },
      { status: 400 }
    )
  }
  if (!progress.finished) {
    return NextResponse.json(
      {
        error: "loop-incomplete",
        message: `Scan all ${await totalCheckpoints(eventId)} checkpoints before minting.`,
        scanned: progress.scanned.length,
        total: progress.total,
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
    increment(Metric.Mint, { outcome: "error", stage: "permit" })
    const message = e instanceof Error ? e.message : "signer-error"
    return NextResponse.json(
      { error: "signer-unavailable", message },
      { status: 500 }
    )
  }

  increment(Metric.Mint, { outcome: "permit_issued" })
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
)
