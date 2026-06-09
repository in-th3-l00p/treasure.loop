import { NextResponse } from "next/server"
import { type Hash, isHash } from "viem"

import { getPlayAddress } from "@/lib/play-session"
import { playerStore } from "@/lib/player-store"

/**
 * Called by the client after the mint transaction confirms on-chain.
 * Stores the mint timestamp on the player record so the prize-desk
 * console can show the player as "badge minted" without polling the
 * chain.
 *
 * The on-chain contract is still the source of truth: the prize-desk
 * UI cross-checks `balanceOf(player)` against this record before
 * handing out the physical reward.
 */
export async function POST(req: Request) {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }

  let body: { txHash?: string }
  try {
    body = (await req.json()) as { txHash?: string }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.txHash || !isHash(body.txHash as Hash)) {
    return NextResponse.json({ error: "invalid-tx-hash" }, { status: 400 })
  }

  const progress = playerStore.recordBadgeMint(address)
  if (!progress) {
    return NextResponse.json(
      { error: "mint-rejected" },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    badgeMintedAt: progress.badgeMintedAt,
    txHash: body.txHash,
  })
}
