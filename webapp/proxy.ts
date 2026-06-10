import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

import { canAccessRoute, isMember, isRole } from "@/lib/authz"
import { buildCsp } from "@/lib/security-headers"

/**
 * Stamp the Content-Security-Policy onto a response.
 *
 * The CSP is nonce-less and pins the exact third-party origins we depend
 * on (Clerk, WalletConnect/RainbowKit, wallet RPC). next/font self-hosts
 * Google Fonts at build time, so no external font origin is needed. The
 * full rationale and the directives that need runtime confirmation live
 * in `lib/security-headers.ts` and `docs/SECURITY_HEADERS.md`.
 *
 * We skip API and webhook paths: they return JSON, not HTML, so a CSP
 * buys nothing there and could interfere with the metadata/webhook
 * consumers.
 */
function withCsp(req: NextRequest, response: NextResponse): NextResponse {
  if (!req.nextUrl.pathname.startsWith("/api")) {
    response.headers.set("Content-Security-Policy", buildCsp())
  }
  return response
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy", // public privacy notice — no auth
  "/login(.*)",
  "/sign-up(.*)",
  "/play(.*)", // attendee surface — wallet auth, not Clerk
  "/api/play/(.*)", // attendee API — guarded by SIWE session, not Clerk
  "/api/badge-metadata/(.*)", // tokenURI target — wallets fetch anonymously
  "/api/webhooks/(.*)", // signed by the provider, not by Clerk session
  "/api/health",
])

const isAppRoute = createRouteMatcher(["/app(.*)"])

// Pages a signed-in user can reach even without a valid org/role.
const isAuthShellRoute = createRouteMatcher([
  "/no-organization(.*)",
  "/forbidden(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return withCsp(req, NextResponse.next())

  const { userId, sessionClaims, redirectToSignIn } = await auth()

  // 1. Must be signed in to enter anything non-public.
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // Auth shell pages always render for signed-in users; the page itself
  // handles the "no org" / "wrong role" UX.
  if (isAuthShellRoute(req)) return withCsp(req, NextResponse.next())

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
      return withCsp(req, NextResponse.redirect(url))
    }

    // Role-gated routes (e.g. booth_staff hitting /app/routes).
    if (!canAccessRoute(subject, req.nextUrl.pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = "/forbidden"
      return withCsp(req, NextResponse.redirect(url))
    }
  }

  return withCsp(req, NextResponse.next())
})

export const config = {
  matcher: [
    // Always run for /app/* and API routes.
    "/(api|trpc)(.*)",
    // Skip Next internals and static files, run for everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
}
