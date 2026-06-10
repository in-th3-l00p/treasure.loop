import { redirect } from "next/navigation"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { listRoutesForOperator } from "@/lib/event-actions"
import { getActiveEvent } from "@/lib/event-queries"

import { OnboardingWizard } from "./_components/onboarding-wizard"

/**
 * Guided first-run setup for a freshly provisioned event. Surfaced from
 * `/app` when the event's `onboardedAt` is null. Organizer-only.
 *
 * The wizard reuses the existing Server Actions end-to-end — it owns no
 * business logic of its own:
 *   - step 1/2 → `updateEventSettings` (name, dates, venue)
 *   - step 3   → `createRoute`
 *   - step 4   → `inviteStaff`
 *   - finish   → `completeOnboarding` (stamps `onboardedAt`)
 */
export default async function OnboardingPage() {
  await requireRoles([ROLES.ORGANIZER])
  const event = await getActiveEvent()
  if (!event) {
    return (
      <PageEmpty title="No active event">
        Create an event organization first.
      </PageEmpty>
    )
  }

  // Already onboarded — nothing to do here. Send them to the console.
  if (event.onboardedAt) {
    redirect("/app")
  }

  const routes = await listRoutesForOperator()

  return (
    <ProductPage width="narrow">
      <PageHeader
        title="Set up your event"
        description="A guided pass through the essentials. You can skip and finish any of this later from the console."
      />
      <OnboardingWizard
        initial={{
          name: event.name,
          venue: event.venue,
          datesStart: event.datesStart
            ? event.datesStart.toISOString().slice(0, 10)
            : "",
          datesEnd: event.datesEnd
            ? event.datesEnd.toISOString().slice(0, 10)
            : "",
        }}
        existingRouteCount={routes.length}
      />
    </ProductPage>
  )
}
