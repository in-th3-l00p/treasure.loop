import Link from "next/link"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { getActiveEvent } from "@/lib/event-queries"
import { buildPreflightReport } from "@/lib/preflight"
import { cn } from "@/lib/utils"

export default async function PreflightPage() {
  await requireRoles([ROLES.ORGANIZER])
  const event = await getActiveEvent()
  if (!event) {
    return <PageEmpty title="No active event" />
  }

  const report = await buildPreflightReport(event.id)
  const summary = [
    report.failures > 0 && `${report.failures} blocking`,
    report.warnings > 0 && `${report.warnings} to review`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <ProductPage width="narrow">
      <PageHeader
        title="Preflight"
        description="Go/no-go checks before you open doors. Re-run this any time; the data is fresh on every load."
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
            report.ready
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/40 bg-rose-500/10 text-rose-200"
          )}
        >
          <span className="status-dot" />
          {report.ready ? "Ready to run" : "Blocked"}
        </div>
      </PageHeader>

      {summary && (
        <p className="mb-6 font-mono text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          {summary}
        </p>
      )}

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
              <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
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
    </ProductPage>
  )
}
