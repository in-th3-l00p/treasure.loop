import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import {
  type AuthSubject,
  type Role,
  hasRole,
  isMember,
  normalizeRole,
} from "./authz"

/**
 * Server-side helper that turns Clerk's `auth()` claims into our `AuthSubject`.
 * Use it inside server components and server actions to drive authorization
 * decisions through the same policy module as middleware.
 */
export async function getSubject(): Promise<AuthSubject> {
  let userId: string | null | undefined
  let orgId: string | null | undefined
  let orgRoleRaw: unknown
  try {
    const result = await auth()
    userId = result.userId
    // Read the parsed top-level fields. Clerk v7's default v2 session
    // token encodes the active org under the compact `o` claim (not
    // `org_id`), so digging into raw `sessionClaims.org_id` returns
    // undefined and the org-scoped console can never load. `auth()`
    // exposes the resolved values directly.
    orgId = result.orgId
    orgRoleRaw = result.orgRole
    if (!orgId) {
      // Fallback for older JWT templates that expose org_id explicitly.
      const claims = result.sessionClaims as Record<string, unknown> | null
      if (typeof claims?.org_id === "string") orgId = claims.org_id
      if (orgRoleRaw == null) orgRoleRaw = claims?.org_role
    }
  } catch {
    // Thrown when @clerk/backend has no publishable key configured. We
    // treat the request as anonymous so the caller's redirect-to-login
    // logic takes over instead of surfacing a 500 to the user.
    return { userId: null, orgId: null, orgRole: null }
  }

  return {
    userId: userId ?? null,
    orgId: orgId ?? null,
    orgRole: normalizeRole(orgRoleRaw),
  }
}

/**
 * Defense-in-depth guard for pages. Middleware already enforces the same
 * checks, but pages call this to be safe against middleware misconfig.
 *
 * Throws via redirect to /forbidden if the subject doesn't have one of the
 * allowed roles; to /login if anonymous; to /no-organization if signed in
 * but unaffiliated.
 */
export async function requireRoles(allowed: readonly Role[]): Promise<AuthSubject> {
  const subject = await getSubject()

  if (!subject.userId) redirect("/login")
  if (!isMember(subject)) redirect("/no-organization")
  if (!hasRole(subject, allowed)) redirect("/forbidden")

  return subject
}

/**
 * The signed-in user's verified email addresses, lowercased. Used to
 * scope a `sponsor`-role user to the sponsor booth(s) whose
 * `contact_email` matches their account. Returns `[]` for anonymous
 * users or when Clerk isn't configured.
 */
export async function getSubjectEmails(): Promise<string[]> {
  try {
    const user = await currentUser()
    if (!user) return []
    // VERIFIED emails only. An unverified address can be added to a Clerk
    // account without proving ownership; counting it would let a sponsor
    // user claim another sponsor's booth scope by adding their email.
    return user.emailAddresses
      .filter((e) => e.verification?.status === "verified")
      .map((e) => e.emailAddress?.toLowerCase())
      .filter((e): e is string => Boolean(e))
  } catch {
    return []
  }
}

/** Lighter variant: just requires org membership. */
export async function requireMember(): Promise<AuthSubject> {
  const subject = await getSubject()

  if (!subject.userId) redirect("/login")
  if (!isMember(subject)) redirect("/no-organization")

  return subject
}
