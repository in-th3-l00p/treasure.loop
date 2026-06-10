import { NextResponse } from "next/server"

import { db } from "@/db/client"
import { rollupAllEvents } from "@/lib/sponsor-analytics"

/**
 * GET /api/cron/rollup-sponsor-traffic
 *
 * Recomputes `sponsor_traffic_hourly` from `scans` for every event,
 * idempotently. Meant to be called every few minutes by Vercel Cron
 * (or pg_cron) so the sponsor report reads pre-aggregated buckets
 * instead of hot-looping over the raw scan log.
 *
 * Guard
 * ─────
 * If `CRON_SECRET` is set, the request must carry it as
 * `Authorization: Bearer <secret>` (Vercel Cron sends this header) or
 * `?secret=<secret>`. If it's unset (local dev) the route is a no-op-safe
 * open endpoint — the rollup only re-derives data already in the DB, so
 * an unguarded dev call leaks nothing and can't corrupt state.
 *
 * Ops: wiring the actual schedule is a Vercel Cron / pg_cron config step
 * (e.g. `vercel.json` crons entry hitting this path every 5 minutes) and
 * setting `CRON_SECRET` in the environment.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    const url = new URL(req.url)
    const provided =
      auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret") ?? ""
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const buckets = await rollupAllEvents(db)
  return NextResponse.json(
    { ok: true, buckets },
    { headers: { "Cache-Control": "no-store" } }
  )
}
