import { NextResponse } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { canAccessRoute, isMember, isRole } from "@/lib/authz"

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/play(.*)", // attendee surface — wallet auth, not Clerk
  "/api/play/(.*)", // attendee API — guarded by SIWE session, not Clerk
  "/api/health",
])

const isAppRoute = createRouteMatcher(["/app(.*)"])

// Pages a signed-in user can reach even without a valid org/role.
const isAuthShellRoute = createRouteMatcher([
  "/no-organization(.*)",
  "/forbidden(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { userId, sessionClaims, redirectToSignIn } = await auth()

  // 1. Must be signed in to enter anything non-public.
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // Auth shell pages always render for signed-in users; the page itself
  // handles the "no org" / "wrong role" UX.
  if (isAuthShellRoute(req)) return

  // 2. Inside /app/* every page must pass the authz policy.
  if (isAppRoute(req)) {
    const orgId =
      typeof sessionClaims?.org_id === "string"
        ? sessionClaims.org_id
        : null
    const orgRoleRaw = sessionClaims?.org_role
    const subject = {
      userId,
      orgId,
      orgRole: isRole(orgRoleRaw) ? orgRoleRaw : null,
    }

    // No active org → push them to a page that prompts them to create or join one.
    if (!isMember(subject)) {
      const url = req.nextUrl.clone()
      url.pathname = "/no-organization"
      return NextResponse.redirect(url)
    }

    // Role-gated routes (e.g. booth_staff hitting /app/routes).
    if (!canAccessRoute(subject, req.nextUrl.pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = "/forbidden"
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    // Always run for /app/* and API routes.
    "/(api|trpc)(.*)",
    // Skip Next internals and static files, run for everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
}
