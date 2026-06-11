import "server-only"

import { and, desc, eq, isNull, ne } from "drizzle-orm"

import { db } from "@/db/client"
import { events } from "@/db/schema"
import { getPlaySession } from "@/lib/play-session"
import { currentEventId } from "@/lib/player-store"

/**
 * Public, player-facing event discovery + the play event resolver.
 *
 * This is the multi-event entry point: the Explore directory, the public
 * event page, and the resolver that tells the play APIs which event the
 * player is currently inside.
 */

export interface PublicEventCard {
  id: string
  slug: string
  name: string
  summary: string | null
  coverImageUrl: string | null
  venue: string | null
  network: string
  status: string
  startsAt: number | null
  endsAt: number | null
}

const CARD_COLUMNS = {
  id: events.id,
  slug: events.slug,
  name: events.name,
  summary: events.summary,
  coverImageUrl: events.coverImageUrl,
  venue: events.venue,
  network: events.network,
  status: events.status,
  startsAt: events.datesStart,
  endsAt: events.datesEnd,
} as const

type CardRow = {
  id: string
  slug: string
  name: string
  summary: string | null
  coverImageUrl: string | null
  venue: string | null
  network: string
  status: string
  startsAt: Date | null
  endsAt: Date | null
}

function toCard(row: CardRow): PublicEventCard {
  return {
    ...row,
    startsAt: row.startsAt?.getTime() ?? null,
    endsAt: row.endsAt?.getTime() ?? null,
  }
}

/** Events listed in the public Explore directory, soonest first. */
export async function listPublicEvents(): Promise<PublicEventCard[]> {
  const rows = await db
    .select(CARD_COLUMNS)
    .from(events)
    .where(and(eq(events.visibility, "public"), isNull(events.archivedAt)))
    .orderBy(desc(events.datesStart))
  return rows.map(toCard)
}

/**
 * A single event by slug for the public event page / play entry. Private
 * events are not reachable here (they 404 for non-members).
 */
export async function getPublicEventCardBySlug(
  slug: string
): Promise<PublicEventCard | null> {
  const [row] = await db
    .select(CARD_COLUMNS)
    .from(events)
    .where(
      and(
        eq(events.slug, slug),
        isNull(events.archivedAt),
        ne(events.visibility, "private")
      )
    )
    .limit(1)
  return row ? toCard(row) : null
}

/**
 * The event id the play APIs should operate on: the session's active
 * event if one is selected and still valid, otherwise the single live
 * event (backward-compatible single-event behaviour).
 */
export async function playEventId(): Promise<string> {
  const session = await getPlaySession()
  if (session.activeEventId) {
    const [row] = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, session.activeEventId), isNull(events.archivedAt)))
      .limit(1)
    if (row) return row.id
  }
  return currentEventId()
}

/**
 * Mark the session's active event by slug. Returns the event id, or null
 * if no discoverable (non-private, non-archived) event matches.
 */
export async function selectActiveEvent(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.slug, slug),
        isNull(events.archivedAt),
        ne(events.visibility, "private")
      )
    )
    .limit(1)
  if (!row) return null
  const session = await getPlaySession()
  session.activeEventId = row.id
  await session.save()
  return row.id
}
