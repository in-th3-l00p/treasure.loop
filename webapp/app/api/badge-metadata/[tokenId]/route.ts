import { NextResponse } from "next/server"

import { buildBadgeMetadata } from "@/lib/badge-metadata"
import { networkLabel } from "@/lib/play-client"
import { currentEventId, getPublicEvent } from "@/lib/player-store"

/**
 * tokenURI target for TreasureLoopBadge: `baseURI + tokenId`.
 * Public by design — wallets and marketplaces fetch it anonymously.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: raw } = await params
  const tokenId = Number(raw)
  if (!Number.isSafeInteger(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: "invalid-token-id" }, { status: 400 })
  }

  let eventId: string
  try {
    eventId = await currentEventId()
  } catch {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }
  const event = await getPublicEvent(eventId)
  if (!event) {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }

  return NextResponse.json(
    buildBadgeMetadata({
      tokenId,
      eventName: event.name,
      networkName: networkLabel(event.network),
    }),
    {
      headers: {
        // Short-lived CDN cache; the event name can change before mint.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  )
}
