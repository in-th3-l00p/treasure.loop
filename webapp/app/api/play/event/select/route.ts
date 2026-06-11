import { NextResponse } from "next/server"

import { selectActiveEvent } from "@/lib/events-public"
import { withRouteLogging } from "@/lib/logger"

/**
 * Enter an event's play surface: mark it the session's active event so
 * every subsequent play API scopes to it. Called when the player opens
 * `/e/[slug]/play`. No auth required — selecting an event to play is fine
 * before signing in with a wallet.
 */
export const POST = withRouteLogging(
  "play/event/select",
  async (req: Request) => {
    let body: { slug?: string }
    try {
      body = (await req.json()) as { slug?: string }
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 })
    }
    if (!body.slug) {
      return NextResponse.json({ error: "missing-slug" }, { status: 400 })
    }
    const eventId = await selectActiveEvent(body.slug)
    if (!eventId) {
      return NextResponse.json({ error: "event-not-found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, eventId })
  }
)
