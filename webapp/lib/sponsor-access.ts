import "server-only"

import { and, asc, eq, isNull } from "drizzle-orm"

import { db } from "@/db/client"
import { sponsors } from "@/db/schema"
import { getSubject, getSubjectEmails } from "./auth-server"
import { ROLES, hasRole } from "./authz"
import { getActiveEvent } from "./event-queries"
import { scopeSponsorsForViewer } from "./sponsor-analytics"

/**
 * Server-side privacy gate for sponsor reports.
 *
 * Resolves the caller's active event and the set of sponsors they're
 * allowed to see: an organizer sees all; a `sponsor`-role user sees only
 * the booth(s) whose `contact_email` matches their Clerk account. This is
 * the single place that turns "signed-in user" into "may view sponsor X."
 */

export interface SponsorScopeRow {
  id: string
  name: string
  tier: "gold" | "prize" | "community"
  contactEmail: string | null
}

export interface SponsorScope {
  eventId: string
  isOrganizer: boolean
  /** Sponsors this caller may view, name-sorted. */
  sponsors: SponsorScopeRow[]
}

/** Returns the caller's sponsor scope, or null if they have no event. */
export async function resolveSponsorScope(): Promise<SponsorScope | null> {
  const subject = await getSubject()
  if (!hasRole(subject, [ROLES.ORGANIZER, ROLES.SPONSOR])) return null

  const event = await getActiveEvent(subject.orgId)
  if (!event) return null

  const all = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      tier: sponsors.tier,
      contactEmail: sponsors.contactEmail,
    })
    .from(sponsors)
    .where(and(eq(sponsors.eventId, event.id), isNull(sponsors.archivedAt)))
    .orderBy(asc(sponsors.name))

  const isOrganizer = hasRole(subject, [ROLES.ORGANIZER])
  const viewerEmails = isOrganizer ? [] : await getSubjectEmails()
  const visible = scopeSponsorsForViewer(all, { isOrganizer, viewerEmails })

  return { eventId: event.id, isOrganizer, sponsors: visible }
}

/**
 * Returns true if the caller may view this specific sponsor's report.
 * Used by the CSV export and the share-link create/revoke actions.
 */
export async function canViewSponsor(sponsorId: string): Promise<boolean> {
  const scope = await resolveSponsorScope()
  if (!scope) return false
  return scope.sponsors.some((s) => s.id === sponsorId)
}
