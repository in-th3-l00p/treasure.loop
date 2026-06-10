import { auth, clerkClient } from "@clerk/nextjs/server"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { getActiveEvent } from "@/lib/event-queries"

import { InviteForm } from "./_components/invite-form"
import { TeamTable } from "./_components/team-table"

const roleLabels: Record<string, string> = {
  "org:organizer": "Organizer",
  "org:prize_desk": "Prize desk",
  "org:booth_staff": "Booth staff",
  "org:sponsor": "Sponsor",
}

export default async function TeamPage() {
  await requireRoles([ROLES.ORGANIZER])
  const { orgId } = await auth()
  const event = await getActiveEvent()

  if (!orgId || !event) {
    return (
      <PageEmpty title="No active event">
        Create an event organization first.
      </PageEmpty>
    )
  }

  const client = await clerkClient()
  const [memberships, invitations] = await Promise.all([
    client.organizations
      .getOrganizationMembershipList({
        organizationId: orgId,
        limit: 100,
      })
      .then((r) => r.data)
      .catch(() => []),
    client.organizations
      .getOrganizationInvitationList({
        organizationId: orgId,
        status: ["pending"],
        limit: 100,
      })
      .then((r) => r.data)
      .catch(() => []),
  ])

  return (
    <ProductPage width="narrow">
      <PageHeader
        title="Team"
        description="Invite booth staff, prize-desk operators, and sponsors. Roles determine what they can see and do in the console."
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <section>
          <div className="mb-3 border-b border-border pb-3">
            <h2 className="text-sm font-medium">Invite someone</h2>
            <p className="text-xs text-muted-foreground">
              They receive an email with a join link.
            </p>
          </div>
          <InviteForm />
        </section>

        <section>
          <div className="mb-3 border-b border-border pb-3">
            <h2 className="text-sm font-medium">Current team</h2>
            <p className="text-xs text-muted-foreground">
              {memberships.length} members · {invitations.length} pending
            </p>
          </div>
          <TeamTable
            memberships={memberships.map((m) => ({
              id: m.id,
              userId: m.publicUserData?.userId ?? "",
              name:
                [m.publicUserData?.firstName, m.publicUserData?.lastName]
                  .filter(Boolean)
                  .join(" ") || m.publicUserData?.identifier || "—",
              email: m.publicUserData?.identifier ?? "",
              role: roleLabels[m.role] ?? m.role,
            }))}
            invitations={invitations.map((i) => ({
              id: i.id,
              email: i.emailAddress,
              role: roleLabels[i.role ?? ""] ?? i.role ?? "—",
            }))}
          />
        </section>
      </div>
    </ProductPage>
  )
}
