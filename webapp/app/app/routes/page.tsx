import { auth, clerkClient } from "@clerk/nextjs/server"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { listRoutesForOperator } from "@/lib/event-actions"
import {
  getActiveEvent,
  listCheckpoints,
  listSponsors,
  listStaffByCheckpoint,
} from "@/lib/event-queries"

import { CreateRouteForm, PublishToggle, RouteEditor } from "./_components"

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ cp?: string }>
}) {
  await requireRoles([ROLES.ORGANIZER])
  const event = await getActiveEvent()
  if (!event) {
    return (
      <PageEmpty title="No active event">
        Run <code className="font-mono text-xs">npm run db:seed</code> from the
        webapp directory to create the pilot event.
      </PageEmpty>
    )
  }

  const routes = await listRoutesForOperator()
  const route = routes[0] ?? null
  if (!route) {
    return (
      <ProductPage width="narrow">
        <PageHeader
          title="Route builder"
          description="A route is the ordered loop of checkpoints players walk. Create one to start placing stops."
        />
        <div className="max-w-sm">
          <CreateRouteForm />
        </div>
      </ProductPage>
    )
  }

  const [allCheckpoints, sponsors, staffMap, staffNames, { cp }] =
    await Promise.all([
      listCheckpoints(event.id),
      listSponsors(event.id),
      listStaffByCheckpoint(event.id),
      resolveStaffNames(),
      searchParams,
    ])
  const checkpoints = allCheckpoints.filter((c) => c.routeId === route.id)

  const staffByCheckpoint: Record<
    string,
    { userId: string; name: string; isPrimary: boolean }[]
  > = {}
  for (const [checkpointId, entries] of staffMap) {
    staffByCheckpoint[checkpointId] = entries.map((e) => ({
      userId: e.userId,
      name: staffNames.get(e.userId) ?? e.userId,
      isPrimary: e.isPrimary,
    }))
  }

  const selectedId =
    cp && checkpoints.some((c) => c.id === cp) ? cp : null

  return (
    <ProductPage>
      <PageHeader
        title="Route builder"
        description="Order checkpoints, assign sponsors, and configure the clue each player has to solve to move on."
      >
        <PublishToggle route={route} />
      </PageHeader>

      <RouteEditor
        route={route}
        checkpoints={checkpoints}
        sponsors={sponsors.map((s) => ({ id: s.id, name: s.name }))}
        staffByCheckpoint={staffByCheckpoint}
        initialSelectedId={selectedId}
      />
    </ProductPage>
  )
}

/** userId → display name, via the Clerk org membership list. */
async function resolveStaffNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const { orgId } = await auth()
    if (!orgId) return names
    const client = await clerkClient()
    const memberships = await client.organizations.getOrganizationMembershipList(
      { organizationId: orgId, limit: 100 }
    )
    for (const m of memberships.data) {
      const userId = m.publicUserData?.userId
      if (!userId) continue
      const name =
        [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(" ") ||
        m.publicUserData?.identifier ||
        userId
      names.set(userId, name)
    }
  } catch {
    // Clerk unavailable (keyless dev) — fall back to raw user ids.
  }
  return names
}
