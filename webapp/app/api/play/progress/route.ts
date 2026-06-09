import { NextResponse } from "next/server"

import { getPlayAddress } from "@/lib/play-session"
import {
  playerStore,
  toPublicProgress,
  totalCheckpoints,
} from "@/lib/player-store"

export async function GET() {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }

  const existing = playerStore.get(address) ?? playerStore.ensure(address)
  return NextResponse.json({
    progress: toPublicProgress(existing),
    total: totalCheckpoints(),
  })
}
