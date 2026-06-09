import { requireMember } from "@/lib/auth-server"
import { APP_ROUTES, type AuthSubject } from "@/lib/authz"

import { AppShell } from "./_components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const subject = await requireMember()
  const reachable = visibleRoutes(subject)
  return <AppShell reachable={reachable}>{children}</AppShell>
}

function visibleRoutes(subject: AuthSubject): Set<string> {
  return new Set(
    APP_ROUTES.filter((r) => r.check(subject)).map((r) => r.href)
  )
}
