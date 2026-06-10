import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db/client"
import { checkpoints, events } from "@/db/schema"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"

import { KioskScreen } from "./_components/kiosk-screen"

export default async function BoothKioskPage({
  params,
}: {
  params: Promise<{ checkpointId: string }>
}) {
  await requireRoles([ROLES.ORGANIZER, ROLES.BOOTH_STAFF])
  const { checkpointId } = await params

  const [row] = await db
    .select({
      id: checkpoints.id,
      name: checkpoints.name,
      area: checkpoints.area,
      status: checkpoints.status,
      secret: checkpoints.totpSecret,
      clue: checkpoints.clue,
      eventName: events.name,
    })
    .from(checkpoints)
    .innerJoin(events, eq(events.id, checkpoints.eventId))
    .where(
      and(eq(checkpoints.id, checkpointId), isNull(checkpoints.archivedAt))
    )
    .limit(1)

  if (!row) notFound()

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-6 pt-10 pb-16 lg:px-10">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            {row.eventName}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            {row.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.area ?? "—"}
          </p>
        </div>
        <Link
          href="/app/booth"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All checkpoints
        </Link>
      </header>

      {row.secret ? (
        <KioskScreen
          checkpointId={row.id}
          checkpointName={row.name}
          secret={row.secret}
          paused={row.status === "offline"}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/10 p-8 text-center text-sm text-rose-200">
          This checkpoint has no TOTP secret configured. Open Routes →
          this checkpoint → Rotate code to provision one.
        </div>
      )}

      {row.clue && (
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Clue shown to player
          </p>
          <p className="mt-2 text-sm leading-relaxed">{row.clue}</p>
        </div>
      )}
    </div>
  )
}
