/**
 * Authorization policy for the TreasureLoop organizer console.
 *
 * Trust model
 * ───────────
 * - Operators (organizer, prize_desk, booth_staff, sponsor) authenticate
 *   through Clerk. Each event is a Clerk Organization.
 * - A user without an active organization can sign in but cannot act on
 *   any event resource — they must accept an invitation or create an
 *   organization first.
 * - All policy decisions live here. Routes, server actions, and UI
 *   components call `can*` functions. They never inline role checks.
 *
 * Role hierarchy (most → least powerful)
 * ──────────────────────────────────────
 *   organizer     full read/write across the event
 *   prize_desk    verify badges and redeem rewards
 *   booth_staff   issue scans at their assigned checkpoint
 *   sponsor       read-only view of their own booth metrics
 */

export const ROLES = {
  ORGANIZER: "org:organizer",
  PRIZE_DESK: "org:prize_desk",
  BOOTH_STAFF: "org:booth_staff",
  SPONSOR: "org:sponsor",
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

export const ALL_ROLES: readonly Role[] = Object.values(ROLES)

/**
 * The subject of an authorization decision. We accept the minimal shape
 * we need from Clerk's `auth()` return value so that tests and server
 * code can both construct one without importing Clerk's runtime.
 */
export interface AuthSubject {
  /** Stable Clerk user id, e.g. `user_2abc…`. Null if anonymous. */
  userId: string | null
  /** Active Clerk org id, e.g. `org_2abc…`. Null if no org selected. */
  orgId: string | null
  /** Active org role for this user, e.g. `org:organizer`. */
  orgRole: Role | string | null
}

const ROLE_VALUES: ReadonlySet<string> = new Set(ALL_ROLES)

/** Type guard: narrows an unknown string to a known Role. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_VALUES.has(value)
}

/**
 * Normalize a Clerk org role into one of our app roles.
 *
 * The app defines custom roles (`org:organizer`, `org:prize_desk`, …)
 * that an organizer assigns per invitation. But Clerk also ships two
 * BUILT-IN org roles — `org:admin` and `org:member` — and the person who
 * creates the organization is an `org:admin`. Semantically the org admin
 * is the event organizer (full access), so we map `org:admin` →
 * `org:organizer`. This lets the console work against any Clerk instance
 * without first configuring custom roles. A plain `org:member` with no
 * assigned app role has no operational permissions (returns null).
 */
export function normalizeRole(value: unknown): Role | null {
  if (isRole(value)) return value
  if (value === "org:admin" || value === "admin") return ROLES.ORGANIZER
  return null
}

/** Returns true if the subject is signed in *and* a member of an org. */
export function isMember(subject: AuthSubject): boolean {
  return Boolean(subject.userId && subject.orgId && isRole(subject.orgRole))
}

/** Returns true if the subject's active role matches any of the given roles. */
export function hasRole(subject: AuthSubject, allowed: readonly Role[]): boolean {
  if (!isMember(subject)) return false
  return allowed.includes(subject.orgRole as Role)
}

// ─────────────────────────── Policy surface ───────────────────────────
//
// One function per question. Add a new policy here rather than scattering
// `if (role === …)` checks across pages.

/** Anyone in the org can see the live overview. */
export function canViewOverview(subject: AuthSubject): boolean {
  return isMember(subject)
}

/** Only organizers configure routes, checkpoints, sponsors. */
export function canConfigureEvent(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER])
}

/** Booth staff issue scan codes at their assigned checkpoint. Organizers can too. */
export function canIssueScan(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER, ROLES.BOOTH_STAFF])
}

/** Prize desk staff verify badges and redeem rewards. Organizers can too. */
export function canVerifyRedemption(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER, ROLES.PRIZE_DESK])
}

/** Player records — organizers see all, sponsors see only their own leads. */
export function canViewPlayers(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER])
}

/** Sponsor reports — organizers see all, sponsors see only their own. */
export function canViewSponsorReports(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER, ROLES.SPONSOR])
}

/** Inviting more operators is organizer-only. */
export function canInviteStaff(subject: AuthSubject): boolean {
  return hasRole(subject, [ROLES.ORGANIZER])
}

// ─────────────────────────── Route map ────────────────────────────────
//
// Single source of truth for which roles can land on each `/app/*` route.
// Used by both the server-side route guard and the AppShell nav (to hide
// items a user can't enter).

export interface RoutePolicy {
  href: string
  check: (subject: AuthSubject) => boolean
}

export const APP_ROUTES: RoutePolicy[] = [
  { href: "/app", check: canViewOverview },
  { href: "/app/onboarding", check: canConfigureEvent },
  { href: "/app/live", check: canConfigureEvent },
  { href: "/app/routes", check: canConfigureEvent },
  { href: "/app/checkpoints", check: canConfigureEvent },
  { href: "/app/sponsors", check: canViewSponsorReports },
  { href: "/app/players", check: canViewPlayers },
  { href: "/app/prize-desk", check: canVerifyRedemption },
  { href: "/app/verification", check: canVerifyRedemption },
  { href: "/app/booth", check: canIssueScan },
  { href: "/app/team", check: canInviteStaff },
  { href: "/app/preflight", check: canConfigureEvent },
]

/** Returns true if the subject is allowed at `pathname`. Unknown paths default to member-only. */
export function canAccessRoute(
  subject: AuthSubject,
  pathname: string
): boolean {
  if (!isMember(subject)) return false
  // Exact match first.
  const exact = APP_ROUTES.find((r) => r.href === pathname)
  if (exact) return exact.check(subject)
  // Longest prefix match for nested routes (e.g. `/app/sponsors/neon-labs`).
  const prefixed = APP_ROUTES
    .filter((r) => pathname.startsWith(`${r.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (prefixed) return prefixed.check(subject)
  // Default: any org member can be at an unmapped `/app/*` route.
  return true
}
