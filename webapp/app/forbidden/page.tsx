import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { ShieldOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const roleLabel: Record<string, string> = {
  "org:organizer": "Organizer",
  "org:prize_desk": "Prize desk staff",
  "org:booth_staff": "Booth staff",
  "org:sponsor": "Sponsor",
}

export default async function ForbiddenPage() {
  const { sessionClaims } = await auth()
  const role =
    typeof sessionClaims?.org_role === "string"
      ? roleLabel[sessionClaims.org_role] ?? sessionClaims.org_role
      : "Unknown role"

  return (
    <div className="product-shell flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid max-w-md gap-6 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-md bg-rose-500/15 text-rose-300">
          <ShieldOffIcon className="size-5" />
        </span>
        <div className="grid gap-2">
          <h1 className="text-xl font-medium tracking-tight">
            You don&apos;t have access to this surface
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{role}</span>. The
            page you tried to reach is restricted to other roles. If this is
            wrong, ask your organizer to update your role.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" className="h-8" render={<Link href="/app" />}>
            Back to overview
          </Button>
        </div>
      </div>
    </div>
  )
}
