import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import {
  type AuthSubject,
  type Role,
  hasRole,
  isMember,
  isRole,
} from "./authz"

/**
 * Server-side helper that turns Clerk's `auth()` claims into our `AuthSubject`.
 * Use it inside server components and server actions to drive authorization
 * decisions through the same policy module as middleware.
 */
export async function getSubject(): Promise<AuthSubject> {
  let userId: string | null | undefined
  let sessionClaims: Record<string, unknown> | undefined | null
  try {
    const result = await auth()
    userId = result.userId
    sessionClaims = result.sessionClaims as Record<string, unknown> | null
  } catch {
    // Thrown when @clerk/backend has no publishable key configured. We
    // treat the request as anonymous so the caller's redirect-to-login
    // logic takes over instead of surfacing a 500 to the user.
    return { userId: null, orgId: null, orgRole: null }
  }

  const orgId =
    typeof sessionClaims?.org_id === "string" ? sessionClaims.org_id : null
  const orgRoleRaw = sessionClaims?.org_role
  return {
    userId: userId ?? null,
    orgId,
    orgRole: isRole(orgRoleRaw) ? orgRoleRaw : null,
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
