import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db as defaultDb } from "@/db/client"
import {
  checkpoints,
  leadConsents,
  scans,
  sponsorTrafficHourly,
  sponsors,
} from "@/db/schema"

/**
 * Sponsor analytics: traffic, talk-through, hourly rollups, and leads.
 *
 * Like `lib/event-report.ts`, the `db` handle is a parameter so tests
 * can pass a pglite client and route handlers / pages pass the
 * production client. Every number derives from a real table; there is
 * no invented data and no mock fallback.
 *
 * Privacy
 * ───────
 * Aggregate counts (visits, hourly traffic, talk-through) are safe to
 * show a sponsor. Individual wallets are exposed ONLY through
 * `listSponsorLeads`, which reads `lead_consents` — a row exists only
 * when the player explicitly opted in at the booth. The raw scan log is
 * never surfaced to a sponsor.
 */

type Db = typeof defaultDb

/** How close in time the next scan must be to count as a talk-through. */
export const TALK_THROUGH_WINDOW_MS = 10 * 60_000

// ──────────────────────── privacy scoping ──────────────────────────

export interface ScopableSponsor {
  id: string
  contactEmail: string | null
}

/**
 * Which sponsors a viewer may see on the report.
 *
 * - An organizer sees every sponsor in the event.
 * - A `sponsor`-role user sees only the booth(s) whose `contact_email`
 *   matches one of their verified account emails. With no match they see
 *   nothing (honest empty state rather than another sponsor's data).
 *
 * Pure + side-effect free so it's unit-testable; the caller resolves
 * `isOrganizer` and `viewerEmails`.
 */
export function scopeSponsorsForViewer<T extends ScopableSponsor>(
  sponsorsList: T[],
  opts: { isOrganizer: boolean; viewerEmails: string[] }
): T[] {
  if (opts.isOrganizer) return sponsorsList
  const emails = new Set(opts.viewerEmails.map((e) => e.toLowerCase()))
  return sponsorsList.filter(
    (s) => s.contactEmail && emails.has(s.contactEmail.toLowerCase())
  )
}

// ───────────────────────────── traffic ─────────────────────────────

/** Total scans recorded at a sponsor's checkpoints. Aggregate, no PII. */
export async function sponsorVisitCount(
  db: Db,
  sponsorId: string
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(scans)
    .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
    .where(eq(checkpoints.sponsorId, sponsorId))
  return Number(row?.n ?? 0)
}

export interface HourlyTrafficBucket {
  /** Hour bucket start (UTC). */
  bucketStart: Date
  /** "HH:00" label for the chart x-axis. */
  hour: string
  scanCount: number
}

/**
 * Hourly booth traffic for a sponsor over the trailing `hours` window.
 *
 * Read path: prefer the pre-aggregated `sponsor_traffic_hourly` table
 * (kept fresh by the rollup cron). If it has no rows for this sponsor
 * (rollup never ran, or fresh event), fall back to live aggregation over
 * `scans` so the report is never blank when data exists.
 */
export async function sponsorHourlyTraffic(
  db: Db,
  sponsorId: string,
  opts: { hours?: number; now?: Date } = {}
): Promise<HourlyTrafficBucket[]> {
  const hours = opts.hours ?? 8
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - hours * 3_600_000)

  // Prefer the rollup table.
  const rollup = await db
    .select({
      bucketStart: sponsorTrafficHourly.bucketStart,
      scanCount: sponsorTrafficHourly.scanCount,
    })
    .from(sponsorTrafficHourly)
    .where(
      and(
        eq(sponsorTrafficHourly.sponsorId, sponsorId),
        sql`${sponsorTrafficHourly.bucketStart} >= ${since.toISOString()}`
      )
    )
    .orderBy(asc(sponsorTrafficHourly.bucketStart))

  const byBucket = new Map<number, number>()
  if (rollup.length > 0) {
    for (const r of rollup) {
      byBucket.set(truncToHour(r.bucketStart).getTime(), r.scanCount)
    }
  } else {
    // Fallback: live aggregation over the raw scans.
    const live = await db
      .select({
        bucket: sql<string>`date_trunc('hour', ${scans.createdAt})`,
        n: sql<number>`count(*)::int`,
      })
      .from(scans)
      .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
      .where(
        and(
          eq(checkpoints.sponsorId, sponsorId),
          sql`${scans.createdAt} >= ${since.toISOString()}`
        )
      )
      .groupBy(sql`1`)
    for (const r of live) {
      byBucket.set(truncToHour(new Date(r.bucket)).getTime(), Number(r.n))
    }
  }

  // Fill every hour in the window so the chart keeps a stable rhythm.
  const buckets: HourlyTrafficBucket[] = []
  const startHour = truncToHour(since)
  for (let i = 0; i < hours; i++) {
    const d = new Date(startHour.getTime() + i * 3_600_000)
    buckets.push({
      bucketStart: d,
      hour: `${String(d.getUTCHours()).padStart(2, "0")}:00`,
      scanCount: byBucket.get(d.getTime()) ?? 0,
    })
  }
  return buckets
}

function truncToHour(d: Date): Date {
  const t = new Date(d)
  t.setUTCMinutes(0, 0, 0)
  return t
}

// ──────────────────────────── talk-through ──────────────────────────

/**
 * Talk-through count for a sponsor.
 *
 * Definition: a wallet that scanned one of this sponsor's checkpoints
 * AND scanned the next-in-sequence checkpoint (by `order_index` within
 * the same route) within `TALK_THROUGH_WINDOW_MS`. It's a proxy for "the
 * booth conversation led somewhere" — the player kept moving along the
 * route soon after the booth.
 *
 * Counted once per (player, sponsor-checkpoint) pair. A sponsor's
 * talk-through is the number of such qualifying scans across all the
 * sponsor's checkpoints.
 */
export async function sponsorTalkThroughCount(
  db: Db,
  sponsorId: string,
  windowMs: number = TALK_THROUGH_WINDOW_MS
): Promise<number> {
  // All scans at this sponsor's checkpoints, with the route + order of
  // the checkpoint and the player.
  const sponsorScans = await db
    .select({
      playerId: scans.playerId,
      routeId: checkpoints.routeId,
      orderIndex: checkpoints.orderIndex,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
    .where(and(eq(checkpoints.sponsorId, sponsorId), isNull(checkpoints.archivedAt)))

  if (sponsorScans.length === 0) return 0

  let count = 0
  for (const s of sponsorScans) {
    // The "next-in-sequence" checkpoint: same route, smallest order_index
    // strictly greater than this one (skips archived).
    const [nextCp] = await db
      .select({ id: checkpoints.id, orderIndex: checkpoints.orderIndex })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.routeId, s.routeId),
          isNull(checkpoints.archivedAt),
          sql`${checkpoints.orderIndex} > ${s.orderIndex}`
        )
      )
      .orderBy(asc(checkpoints.orderIndex))
      .limit(1)
    if (!nextCp) continue

    // Did this player scan that next checkpoint within the window after
    // the booth scan?
    const [hit] = await db
      .select({ id: scans.id })
      .from(scans)
      .where(
        and(
          eq(scans.playerId, s.playerId),
          eq(scans.checkpointId, nextCp.id),
          sql`${scans.createdAt} >= ${s.createdAt.toISOString()}`,
          sql`${scans.createdAt} <= ${new Date(
            s.createdAt.getTime() + windowMs
          ).toISOString()}`
        )
      )
      .limit(1)
    if (hit) count++
  }
  return count
}

// ───────────────────────────── rollup ──────────────────────────────

/**
 * Recompute the hourly traffic buckets for an event from `scans`,
 * idempotently upserting into `sponsor_traffic_hourly`.
 *
 * For each (sponsor, hour) that has scans, we write the exact count. The
 * upsert keys on the unique (sponsor_id, bucket_start) index, so running
 * the rollup twice over the same data leaves identical rows (the count
 * is overwritten, not added). Returns the number of buckets written.
 *
 * Note: this writes counts that currently exist. It does not delete
 * buckets that dropped to zero (scans are append-only, so a count never
 * decreases) — keeping the function a pure upsert and safe to re-run.
 */
export async function rollupSponsorTraffic(
  db: Db,
  eventId: string
): Promise<number> {
  const rows = await db
    .select({
      sponsorId: checkpoints.sponsorId,
      bucket: sql<string>`date_trunc('hour', ${scans.createdAt})`,
      n: sql<number>`count(*)::int`,
    })
    .from(scans)
    .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
    .where(
      and(
        eq(checkpoints.eventId, eventId),
        sql`${checkpoints.sponsorId} is not null`
      )
    )
    .groupBy(checkpoints.sponsorId, sql`date_trunc('hour', ${scans.createdAt})`)

  let written = 0
  for (const r of rows) {
    if (!r.sponsorId) continue
    await db
      .insert(sponsorTrafficHourly)
      .values({
        eventId,
        sponsorId: r.sponsorId,
        bucketStart: new Date(r.bucket),
        scanCount: Number(r.n),
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          sponsorTrafficHourly.sponsorId,
          sponsorTrafficHourly.bucketStart,
        ],
        set: {
          scanCount: Number(r.n),
          computedAt: new Date(),
          eventId,
        },
      })
    written++
  }
  return written
}

/** Roll up every non-archived event. Used by the cron entrypoint. */
export async function rollupAllEvents(db: Db): Promise<number> {
  const evs = await db
    .select({ id: sponsors.eventId })
    .from(sponsors)
    .where(isNull(sponsors.archivedAt))
    .groupBy(sponsors.eventId)
  let total = 0
  for (const e of evs) {
    total += await rollupSponsorTraffic(db, e.id)
  }
  return total
}

// ────────────────────────────── leads ──────────────────────────────

export interface SponsorLead {
  wallet: string
  checkpointName: string | null
  consentedAt: Date
}

/**
 * Opted-in leads for a sponsor: wallet, the checkpoint they consented
 * at, and when. Sourced from `lead_consents` ONLY — every wallet here
 * gave explicit permission. Never reads the raw scan log.
 */
export async function listSponsorLeads(
  db: Db,
  sponsorId: string
): Promise<SponsorLead[]> {
  const rows = await db
    .select({
      wallet: leadConsents.wallet,
      checkpointName: checkpoints.name,
      consentedAt: leadConsents.createdAt,
    })
    .from(leadConsents)
    .leftJoin(checkpoints, eq(checkpoints.id, leadConsents.checkpointId))
    .where(eq(leadConsents.sponsorId, sponsorId))
    .orderBy(asc(leadConsents.createdAt))
  return rows.map((r) => ({
    wallet: r.wallet,
    checkpointName: r.checkpointName,
    consentedAt: r.consentedAt,
  }))
}

/** Count of opted-in leads for a sponsor. */
export async function sponsorLeadCount(
  db: Db,
  sponsorId: string
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leadConsents)
    .where(eq(leadConsents.sponsorId, sponsorId))
  return Number(row?.n ?? 0)
}

/**
 * Build a CSV string of a sponsor's opted-in leads. Header row plus one
 * line per consented wallet. Fields are quote-escaped so a checkpoint
 * name with a comma can't break the columns.
 */
export function leadsToCsv(leads: SponsorLead[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = ["wallet", "checkpoint", "consented_at"].join(",")
  const rows = leads.map((l) =>
    [
      esc(l.wallet),
      esc(l.checkpointName ?? ""),
      esc(l.consentedAt.toISOString()),
    ].join(",")
  )
  return [header, ...rows].join("\r\n") + "\r\n"
}

// ─────────────────────────── report ────────────────────────────────

export interface SponsorReportData {
  sponsor: { id: string; name: string; tier: string }
  visits: number
  talkThrough: number
  leadCount: number
  hourly: HourlyTrafficBucket[]
  checkpoints: { id: string; name: string; area: string | null; scans: number }[]
}

/**
 * Everything the aggregate report needs for one sponsor. Aggregates only
 * (safe for sponsors and the public share page); individual leads are
 * fetched separately via `listSponsorLeads` where the privacy gate
 * permits.
 */
export async function getSponsorReport(
  db: Db,
  sponsor: { id: string; name: string; tier: string },
  opts: { hours?: number; now?: Date } = {}
): Promise<SponsorReportData> {
  const [visits, talkThrough, leadCount, hourly, cpRows] = await Promise.all([
    sponsorVisitCount(db, sponsor.id),
    sponsorTalkThroughCount(db, sponsor.id),
    sponsorLeadCount(db, sponsor.id),
    sponsorHourlyTraffic(db, sponsor.id, opts),
    db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        area: checkpoints.area,
        scans: sql<number>`(select count(*)::int from ${scans} where ${scans.checkpointId} = ${checkpoints.id})`,
      })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.sponsorId, sponsor.id),
          isNull(checkpoints.archivedAt)
        )
      )
      .orderBy(asc(checkpoints.orderIndex)),
  ])

  return {
    sponsor,
    visits,
    talkThrough,
    leadCount,
    hourly,
    checkpoints: cpRows.map((c) => ({
      id: c.id,
      name: c.name,
      area: c.area,
      scans: Number(c.scans),
    })),
  }
}

// ─────────────────────── consent recording ─────────────────────────

/**
 * Record a lead consent best-effort. Idempotent on (player, sponsor):
 * a re-scan that opts in again is a no-op. Only meaningful for a
 * sponsor-backed checkpoint — the caller resolves the sponsor id from
 * the checkpoint before calling.
 *
 * Never throws: a consent-write failure must not block a scan.
 */
export async function recordLeadConsent(
  db: Db,
  opts: {
    eventId: string
    playerId: string
    checkpointId: string
    sponsorId: string
    wallet: string
  }
): Promise<void> {
  try {
    await db
      .insert(leadConsents)
      .values({
        eventId: opts.eventId,
        playerId: opts.playerId,
        checkpointId: opts.checkpointId,
        sponsorId: opts.sponsorId,
        wallet: opts.wallet,
      })
      .onConflictDoNothing({
        target: [leadConsents.playerId, leadConsents.sponsorId],
      })
  } catch {
    // Best-effort: swallow so the scan response is never blocked.
  }
}
