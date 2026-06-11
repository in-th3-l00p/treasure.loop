import { NextResponse } from "next/server"

import { erasePlayerData } from "@/lib/data-rights"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { playEventId } from "@/lib/events-public"
import { getPlayAddress, getPlaySession } from "@/lib/play-session"

/**
 * POST /api/play/data-erasure
 *
 * GDPR Article 17 (right to erasure). Deletes the authenticated player's
 * scans and redemption claims and anonymizes their player record, then
 * logs them out by destroying the play session. The on-chain badge is NOT
 * touched — it's the player's NFT, not ours to burn (see lib/data-rights).
 *
 * Requires a valid play session; 401 otherwise. The erasure itself writes
 * a best-effort audit_log row inside its transaction.
 */
export const POST = withRouteLogging(
  "play/data-erasure",
  async (_req: Request, ctx: RouteContext) => {
    const address = await getPlayAddress()
    if (!address) {
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })

    const eventId = await playEventId()
    const result = await erasePlayerData(address, eventId)

    // Erasure clears the session-linked identity → end the session.
    const session = await getPlaySession()
    session.destroy()

    ctx.set({ erased: result.erased })
    return NextResponse.json({
      ok: true,
      erased: result.erased,
      scansDeleted: result.scansDeleted,
      redemptionsDeleted: result.redemptionsDeleted,
      badgeMintsKept: result.badgeMintsKept,
    })
  }
)
