import { NextResponse } from "next/server"
import { type Hash, isHash } from "viem"

import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { increment, Metric } from "@/lib/metrics"
import { getPlayAddress } from "@/lib/play-session"
import { currentEventId, recordBadgeMint } from "@/lib/player-store"

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

  let body: { txHash?: string; tokenId?: number }
  try {
    body = (await req.json()) as { txHash?: string; tokenId?: number }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.txHash || !isHash(body.txHash as Hash)) {
    return NextResponse.json({ error: "invalid-tx-hash" }, { status: 400 })
  }

  const eventId = await currentEventId()
  const progress = await recordBadgeMint({
    eventId,
    wallet: address,
    txHash: body.txHash,
    tokenId: body.tokenId,
  })
  if (!progress) {
    increment(Metric.Mint, { outcome: "rejected", stage: "confirm" })
    return NextResponse.json({ error: "mint-rejected" }, { status: 400 })
  }

  increment(Metric.Mint, { outcome: "confirmed" })
  return NextResponse.json({
    ok: true,
    badgeMintedAt: progress.badgeMintedAt,
    txHash: body.txHash,
  })
  }
)
