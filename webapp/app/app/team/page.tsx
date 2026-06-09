import { auth, clerkClient } from "@clerk/nextjs/server"

import { Button } from "@/components/ui/button"
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
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-medium tracking-tight">No active event</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create an event organization first.
        </p>
      </div>
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
    <div className="mx-auto max-w-[1180px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <h1 className="text-xl font-medium tracking-tight">Team</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Invite booth staff, prize-desk operators, and sponsors. Roles
            determine what they can see and do in the console.
          </p>
        </div>
        <Button variant="outline" className="h-8" disabled>
          Bulk invite via CSV
        </Button>
      </header>

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
    </div>
  )
}
