import { auth, clerkClient } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { requireMember } from "@/lib/auth-server"
import { APP_ROUTES, type AuthSubject } from "@/lib/authz"
import { ensureEventForOrg } from "@/lib/event-provisioning"

import { AppShell } from "./_components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const subject = await requireMember()
  if (!subject.orgId) redirect("/no-organization")

  // Defensive provisioning: if the Clerk webhook never fired, create
  // the event row now so the operator never sees an empty console.
  await ensureEventForOrgIfNeeded(subject.orgId)

  const reachable = visibleRoutes(subject)
  return <AppShell reachable={reachable}>{children}</AppShell>
}

async function ensureEventForOrgIfNeeded(orgId: string) {
  try {
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({
      organizationId: orgId,
    })
    await ensureEventForOrg({ orgId, orgName: org.name })
  } catch {
    // Clerk fetch can fail in keyless mode; we fall back to ensuring
    // with a placeholder name so the row exists either way.
    await ensureEventForOrg({ orgId, orgName: "My Event" })
  }
}

function visibleRoutes(subject: AuthSubject): Set<string> {
  return new Set(
    APP_ROUTES.filter((r) => r.check(subject)).map((r) => r.href)
  )
}

// Internal: surface `auth()` so the helper can grab session claims if
// the org-detection logic ever needs to inspect them directly. Not
// currently used but kept here so future code doesn't import a new
// path. Strip if linter complains.
void auth
