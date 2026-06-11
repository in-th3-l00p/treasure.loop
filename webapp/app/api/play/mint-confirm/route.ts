import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"
import { type Hash, isHash } from "viem"

import { MOCK_CHAIN } from "@/lib/badge-contract"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { increment, Metric } from "@/lib/metrics"
import { getPlayAddress } from "@/lib/play-session"
import { playEventId } from "@/lib/events-public"
import { recordBadgeMint } from "@/lib/player-store"

export const POST = withRouteLogging(
  "play/mint-confirm",
  async (req: Request, ctx: RouteContext) => {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }
  ctx.set({ actor: address })

  let body: { txHash?: string; tokenId?: number; mock?: boolean }
  try {
    body = (await req.json()) as {
      txHash?: string
      tokenId?: number
      mock?: boolean
    }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  // PoC mock-chain mode: synthesize a believable receipt with no real
  // transaction. recordBadgeMint still enforces finished + not-rehearsal,
  // so this only fakes the chain, not the eligibility rules.
  let txHash = body.txHash
  let tokenId = body.tokenId
  if (MOCK_CHAIN) {
    if (!txHash || !isHash(txHash as Hash)) {
      txHash = `0x${randomBytes(32).toString("hex")}`
    }
    if (tokenId === undefined) {
      tokenId = Number(BigInt(txHash.slice(0, 10)) % BigInt(1_000_000))
    }
  } else if (!txHash || !isHash(txHash as Hash)) {
    return NextResponse.json({ error: "invalid-tx-hash" }, { status: 400 })
  }

  const eventId = await playEventId()
  const progress = await recordBadgeMint({
    eventId,
    wallet: address,
    txHash: txHash as string,
    tokenId,
  })
  if (!progress) {
    increment(Metric.Mint, { outcome: "rejected", stage: "confirm" })
    return NextResponse.json({ error: "mint-rejected" }, { status: 400 })
  }

  increment(Metric.Mint, { outcome: "confirmed" })
  return NextResponse.json({
    ok: true,
    badgeMintedAt: progress.badgeMintedAt,
    txHash,
    tokenId: tokenId ?? null,
  })
  }
)
