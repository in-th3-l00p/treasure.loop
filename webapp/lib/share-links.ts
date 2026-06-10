import { and, desc, eq, isNull } from "drizzle-orm"

import { db as defaultDb } from "@/db/client"
import { shareLinks, sponsors } from "@/db/schema"

/**
 * Revocable, unauthenticated read-only share links for a sponsor's
 * aggregate report. The token is an unguessable random string; a link is
 * valid while `revoked_at` is null. Token generation + validation live
 * here (pure-ish, db-injectable) so the public page and the Server
 * Actions share one source of truth.
 */

type Db = typeof defaultDb

/** Unguessable URL-safe token (base32, ~80 bits). */
export function generateShareToken(): string {
  const alphabet = "abcdefghjkmnpqrstvwxyz0123456789"
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let out = "shr_"
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export interface ResolvedShareLink {
  token: string
  eventId: string
  sponsorId: string
  sponsorName: string
  sponsorTier: "gold" | "prize" | "community"
}

/**
 * Resolve a share link for the public page. Returns null when the token
 * is unknown, revoked, or doesn't match the requested sponsor. Callers
 * render an honest "expired/revoked" state on null.
 */
export async function resolveShareLink(
  db: Db,
  token: string,
  sponsorId: string
): Promise<ResolvedShareLink | null> {
  const [row] = await db
    .select({
      token: shareLinks.token,
      eventId: shareLinks.eventId,
      sponsorId: shareLinks.sponsorId,
      revokedAt: shareLinks.revokedAt,
      sponsorName: sponsors.name,
      sponsorTier: sponsors.tier,
    })
    .from(shareLinks)
    .innerJoin(sponsors, eq(sponsors.id, shareLinks.sponsorId))
    .where(eq(shareLinks.token, token))
    .limit(1)

  if (!row) return null
  if (row.revokedAt) return null
  if (row.sponsorId !== sponsorId) return null

  return {
    token: row.token,
    eventId: row.eventId,
    sponsorId: row.sponsorId,
    sponsorName: row.sponsorName,
    sponsorTier: row.sponsorTier,
  }
}

/** The current (non-revoked) share link for a sponsor, if any. */
export async function activeShareLinkForSponsor(
  db: Db,
  sponsorId: string
): Promise<{ token: string; createdAt: Date } | null> {
  const [row] = await db
    .select({ token: shareLinks.token, createdAt: shareLinks.createdAt })
    .from(shareLinks)
    .where(
      and(eq(shareLinks.sponsorId, sponsorId), isNull(shareLinks.revokedAt))
    )
    .orderBy(desc(shareLinks.createdAt))
    .limit(1)
  return row ?? null
}
