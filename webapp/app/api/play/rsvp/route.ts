import { NextResponse } from "next/server"

import { getPublicEventCardBySlug } from "@/lib/events-public"
import {
  countGoing,
  getRsvp,
  removeRsvp,
  setRsvp,
  type RsvpStatus,
} from "@/lib/event-rsvp"
import { getPlayAddress } from "@/lib/play-session"

/**
 * Event RSVP API for the player social layer. RSVPs resolve the event
 * by public slug (non-private), so this is the same surface the public
 * event page uses. Writes require a signed-in wallet.
 */

function isStatus(value: unknown): value is RsvpStatus {
  return value === "going" || value === "interested"
}

/**
 * GET ?slug=… — the caller's current RSVP state for an event.
 * Returns `{ signedIn, status, going }`. No auth required; an
 * anonymous caller gets `signedIn: false` and `status: null` but still
 * sees the public going-count.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ error: "missing-slug" }, { status: 400 })
  }

  const event = await getPublicEventCardBySlug(slug)
  if (!event) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }

  const address = await getPlayAddress()
  const [going, status] = await Promise.all([
    countGoing(event.id),
    address ? getRsvp(event.id, address) : Promise.resolve(null),
  ])

  return NextResponse.json({ signedIn: address !== null, status, going })
}

/**
 * POST { slug, status? } — set (or update) the caller's RSVP.
 * 401 if not signed in, 404 if no public event matches the slug.
 * Returns `{ ok, status, going }`.
 */
export async function POST(req: Request) {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
  }

  let body: { slug?: unknown; status?: unknown }
  try {
    body = (await req.json()) as { slug?: unknown; status?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (typeof body.slug !== "string" || body.slug.length === 0) {
    return NextResponse.json({ error: "missing-slug" }, { status: 400 })
  }
  if (body.status !== undefined && !isStatus(body.status)) {
    return NextResponse.json({ error: "invalid-status" }, { status: 400 })
  }

  const event = await getPublicEventCardBySlug(body.slug)
  if (!event) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }

  const status: RsvpStatus = isStatus(body.status) ? body.status : "going"
  await setRsvp(event.id, address, status)
  const going = await countGoing(event.id)

  return NextResponse.json({ ok: true, status, going })
}

/**
 * DELETE { slug } — clear the caller's RSVP. 401 if not signed in.
 * Returns `{ ok, going }` (the updated going-count).
 */
export async function DELETE(req: Request) {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
  }

  let body: { slug?: unknown }
  try {
    body = (await req.json()) as { slug?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (typeof body.slug !== "string" || body.slug.length === 0) {
    return NextResponse.json({ error: "missing-slug" }, { status: 400 })
  }

  const event = await getPublicEventCardBySlug(body.slug)
  if (!event) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }

  await removeRsvp(event.id, address)
  const going = await countGoing(event.id)

  return NextResponse.json({ ok: true, going })
}
