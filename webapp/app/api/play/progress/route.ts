import { NextResponse } from "next/server"

import { withRouteLogging, type RouteContext } from "@/lib/logger"
import {
  ensurePlayer,
  getProgress,
  totalCheckpoints,
} from "@/lib/player-store"
import { getPlayAddress } from "@/lib/play-session"
import { playEventId } from "@/lib/events-public"

export const GET = withRouteLogging(
  "play/progress",
  async (_req: Request, ctx: RouteContext) => {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }
  ctx.set({ actor: address })

  const eventId = await playEventId()
  // Ensure player record exists for first-time visitors.
  await ensurePlayer(eventId, address)
  const progress = await getProgress(eventId, address)
  const total = await totalCheckpoints(eventId)

  return NextResponse.json({
    progress,
    total,
  })
  }
)
