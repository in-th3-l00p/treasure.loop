import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { readBadgePauseState } from "@/lib/badge-pause"
import { getActiveEvent } from "@/lib/event-queries"
import { getLiveOpsSnapshot } from "@/lib/live-ops"

import { LiveDashboard } from "./_components/live-dashboard"

/**
 * Day-of live ops dashboard. Organizer-gated: it shows event-wide
 * throughput, friction, and funnel depth, plus the on-chain minting
 * pause state. Everything refreshes client-side every ~5s.
 */
export default async function LivePage() {
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

  const [snapshot, pause] = await Promise.all([
    getLiveOpsSnapshot(event.id),
    readBadgePauseState(),
  ])

  return (
    <ProductPage>
      <PageHeader
        title="Live ops"
        description="Throughput, friction, and funnel depth as the floor moves — plus minting state and a one-click event report."
      />
      <LiveDashboard initial={{ snapshot, pause }} />
    </ProductPage>
  )
}
