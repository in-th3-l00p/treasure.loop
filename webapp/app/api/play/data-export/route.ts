import { NextResponse } from "next/server"

import { exportPlayerData } from "@/lib/data-rights"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { currentEventId } from "@/lib/player-store"
import { getPlayAddress } from "@/lib/play-session"

/**
 * GET /api/play/data-export
 *
 * GDPR Article 15/20: the authenticated player downloads everything we
 * hold about them (scans, redemptions, badge mints) as a JSON file.
 * Requires a valid play session; 401 otherwise.
 */
export const GET = withRouteLogging(
  "play/data-export",
  async (_req: Request, ctx: RouteContext) => {
    const address = await getPlayAddress()
    if (!address) {
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })

    const eventId = await currentEventId()
    const data = await exportPlayerData(address, eventId)

    const body = JSON.stringify(data, null, 2)
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="treasureloop-data-${address}.json"`,
        // Never let a CDN/proxy cache a personal-data response.
        "Cache-Control": "no-store",
      },
    })
  }
)
