import { NextResponse } from "next/server"

import { playEventId } from "@/lib/events-public"
import { getPublicEvent } from "@/lib/player-store"

/**
 * Public event sheet for the attendee surface: event name, network,
 * and the ordered checkpoints with clues. No auth required — players
 * see clues on the floor anyway; secrets never leave the server.
 */
export async function GET() {
  let eventId: string
  try {
    eventId = await playEventId()
  } catch {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }

  const event = await getPublicEvent(eventId)
  if (!event) {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }

  return NextResponse.json({ event })
}
