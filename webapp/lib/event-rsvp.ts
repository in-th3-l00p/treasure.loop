import "server-only"

import { and, asc, eq, sql } from "drizzle-orm"
import { getAddress } from "viem"

import { db } from "@/db/client"
import { eventRsvps, events, players } from "@/db/schema"

/**
 * Player social layer: event RSVPs ("I'm going" / "interested").
 *
 * RSVPs are keyed by `(eventId, wallet)` with a unique constraint, so
 * a wallet has at most one RSVP per event. Wallets are stored
 * checksummed to match the rest of the player store.
 */

export type RsvpStatus = "going" | "interested"

/**
 * Upsert the caller's RSVP for an event. On conflict (the wallet has
 * already RSVP'd) the status is updated in place.
 */
export async function setRsvp(
  eventId: string,
  wallet: string,
  status: RsvpStatus = "going"
): Promise<void> {
  const checksum = getAddress(wallet)
  await db
    .insert(eventRsvps)
    .values({ eventId, wallet: checksum, status })
    .onConflictDoUpdate({
      target: [eventRsvps.eventId, eventRsvps.wallet],
      set: { status },
    })
}

/** Remove the caller's RSVP for an event (no-op if none exists). */
export async function removeRsvp(eventId: string, wallet: string): Promise<void> {
  const checksum = getAddress(wallet)
  await db
    .delete(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.wallet, checksum)))
}

/** The caller's RSVP status for an event, or null if they haven't RSVP'd. */
export async function getRsvp(
  eventId: string,
  wallet: string
): Promise<RsvpStatus | null> {
  const checksum = getAddress(wallet)
  const [row] = await db
    .select({ status: eventRsvps.status })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.wallet, checksum)))
    .limit(1)
  return row?.status ?? null
}

/** How many wallets have RSVP'd "going" to an event. */
export async function countGoing(eventId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, "going")))
  return row?.count ?? 0
}

export interface MyEvent {
  id: string
  slug: string
  name: string
  summary: string | null
  coverImageUrl: string | null
  venue: string | null
  startsAt: number | null
  endsAt: number | null
  /** The RSVP status if RSVP'd, otherwise 'played' for play-only events. */
  status: RsvpStatus | "played"
  rsvped: boolean
  played: boolean
}

type MyEventRow = {
  id: string
  slug: string
  name: string
  summary: string | null
  coverImageUrl: string | null
  venue: string | null
  startsAt: Date | null
  endsAt: Date | null
  rsvpStatus: RsvpStatus | null
  played: boolean
}

/**
 * Every event a wallet has a connection to: it RSVP'd, or it has a
 * `players` (played) row. Soonest first. Powers a future `/home`.
 *
 * Joins are left so an event surfaces if either side matches; a single
 * GROUP BY collapses multiple play/rsvp rows back to one event card.
 */
export async function listMyEvents(wallet: string): Promise<MyEvent[]> {
  const checksum = getAddress(wallet)
  const rows = (await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      summary: events.summary,
      coverImageUrl: events.coverImageUrl,
      venue: events.venue,
      startsAt: events.datesStart,
      endsAt: events.datesEnd,
      rsvpStatus: sql<RsvpStatus | null>`max(${eventRsvps.status})`,
      played: sql<boolean>`bool_or(${players.id} is not null)`,
    })
    .from(events)
    .leftJoin(
      eventRsvps,
      and(eq(eventRsvps.eventId, events.id), eq(eventRsvps.wallet, checksum))
    )
    .leftJoin(
      players,
      and(eq(players.eventId, events.id), eq(players.wallet, checksum))
    )
    .where(
      sql`(${eventRsvps.wallet} is not null or ${players.wallet} is not null)`
    )
    .groupBy(
      events.id,
      events.slug,
      events.name,
      events.summary,
      events.coverImageUrl,
      events.venue,
      events.datesStart,
      events.datesEnd
    )
    .orderBy(asc(events.datesStart))) as MyEventRow[]

  return rows.map((row) => {
    const rsvped = row.rsvpStatus !== null
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      coverImageUrl: row.coverImageUrl,
      venue: row.venue,
      startsAt: row.startsAt?.getTime() ?? null,
      endsAt: row.endsAt?.getTime() ?? null,
      status: rsvped ? (row.rsvpStatus as RsvpStatus) : "played",
      rsvped,
      played: row.played,
    }
  })
}
