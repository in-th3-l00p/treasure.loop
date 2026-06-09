import Link from "next/link"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"

import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { getActiveEvent } from "@/lib/event-queries"
import { buildPreflightReport } from "@/lib/preflight"
import { cn } from "@/lib/utils"

export default async function PreflightPage() {
  await requireRoles([ROLES.ORGANIZER])
  const event = await getActiveEvent()
  if (!event) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-medium tracking-tight">No active event</h1>
      </div>
    )
  }

  const report = await buildPreflightReport(event.id)

  return (
    <div className="mx-auto max-w-[1180px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <h1 className="text-xl font-medium tracking-tight">Preflight</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Go/no-go checks before you open doors. Re-run this any time;
            the data is fresh on every load.
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
            report.ready
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/40 bg-rose-500/10 text-rose-200"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              report.ready ? "bg-emerald-400" : "bg-rose-400"
            )}
          />
          {report.ready ? "Ready to run" : "Blocked — fix failures first"}
        </div>
      </header>

      <p className="mb-6 text-xs text-muted-foreground">
        {report.failures} failure(s), {report.warnings} warning(s).
      </p>

      <ul className="grid divide-y divide-border border-y border-border">
        {report.checks.map((c) => (
          <li
            key={c.id}
            className="grid grid-cols-[28px_1fr_auto] items-start gap-4 py-4"
          >
            <span className="mt-0.5">
              {c.level === "ok" ? (
                <CheckCircle2Icon className="size-5 text-emerald-400" />
              ) : c.level === "warn" ? (
                <AlertTriangleIcon className="size-5 text-amber-300" />
              ) : (
                <XCircleIcon className="size-5 text-rose-400" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.detail}
              </p>
            </div>
            <div className="text-right">
              {c.fixHref && c.level !== "ok" ? (
                <Link
                  href={c.fixHref}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Fix →
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
