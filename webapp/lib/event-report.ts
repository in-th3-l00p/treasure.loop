import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db as defaultDb } from "@/db/client"
import {
  badgeMints,
  checkpoints,
  events,
  players,
  redemptionClaims,
  rewards,
  scans,
  sponsors,
} from "@/db/schema"

/**
 * Post-event report generator.
 *
 * Two halves, kept apart so the markdown builder stays pure and unit
 * testable:
 *
 *   1. `gatherEventReportData(db, eventId)` — every number comes from a
 *      real query. No invented metrics; an event with no traffic yields
 *      zeros and the anomalies that follow from them.
 *   2. `buildEventReportMarkdown(data, { now })` — a pure function from
 *      gathered data + an injected `now` to a Markdown string. `now` is
 *      injected (never `Date.now()` inside) so the output is
 *      deterministic under test.
 *
 * The `db` handle is a parameter so tests can pass a pglite client and
 * the route handler can pass the production client.
 */

type Db = typeof defaultDb

export interface CheckpointReportRow {
  id: string
  name: string
  area: string | null
  orderIndex: number
  sponsorName: string | null
  scans: number
}

export interface RewardReportRow {
  id: string
  name: string
  stockTotal: number | null
  stockClaimed: number
}

export interface EventReportData {
  event: {
    id: string
    name: string
    venue: string | null
    network: string
    status: string
    datesStart: Date | null
    datesEnd: Date | null
  }
  totals: {
    players: number
    /** Players who minted a finisher badge (completion proof). */
    finishers: number
    badgeMints: number
    sponsorVisits: number
    redemptions: number
  }
  checkpoints: CheckpointReportRow[]
  rewards: RewardReportRow[]
}

/**
 * Pull every figure the report needs for one event, in real SQL.
 * Scoped to a single event id; archived checkpoints are excluded from
 * the checkpoint breakdown but their historical scans still count
 * toward totals (we never delete rows, only soft-archive).
 */
export async function gatherEventReportData(
  db: Db,
  eventId: string
): Promise<EventReportData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) return null

  const [
    [{ n: playerCount }],
    [{ n: finisherCount }],
    [{ n: sponsorVisits }],
    [{ n: redemptionCount }],
    checkpointRows,
    rewardRows,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.eventId, eventId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(badgeMints)
      .innerJoin(players, eq(players.id, badgeMints.playerId))
      .where(eq(players.eventId, eventId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(scans)
      .innerJoin(checkpoints, eq(checkpoints.id, scans.checkpointId))
      .where(eq(checkpoints.eventId, eventId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(redemptionClaims)
      .innerJoin(rewards, eq(rewards.id, redemptionClaims.rewardId))
      .where(eq(rewards.eventId, eventId)),
    db
      .select({
        id: checkpoints.id,
        name: checkpoints.name,
        area: checkpoints.area,
        orderIndex: checkpoints.orderIndex,
        sponsorName: sponsors.name,
        scans: sql<number>`(select count(*)::int from ${scans} where ${scans.checkpointId} = ${checkpoints.id})`,
      })
      .from(checkpoints)
      .leftJoin(sponsors, eq(sponsors.id, checkpoints.sponsorId))
      .where(
        and(eq(checkpoints.eventId, eventId), isNull(checkpoints.archivedAt))
      )
      .orderBy(asc(checkpoints.orderIndex)),
    db
      .select({
        id: rewards.id,
        name: rewards.name,
        stockTotal: rewards.stockTotal,
        stockClaimed: rewards.stockClaimed,
      })
      .from(rewards)
      .where(eq(rewards.eventId, eventId))
      .orderBy(asc(rewards.name)),
  ])

  return {
    event: {
      id: event.id,
      name: event.name,
      venue: event.venue,
      network: event.network,
      status: event.status,
      datesStart: event.datesStart,
      datesEnd: event.datesEnd,
    },
    totals: {
      players: playerCount,
      finishers: finisherCount,
      badgeMints: finisherCount,
      sponsorVisits,
      redemptions: redemptionCount,
    },
    checkpoints: checkpointRows.map((r) => ({
      id: r.id,
      name: r.name,
      area: r.area,
      orderIndex: r.orderIndex,
      sponsorName: r.sponsorName,
      scans: r.scans,
    })),
    rewards: rewardRows.map((r) => ({
      id: r.id,
      name: r.name,
      stockTotal: r.stockTotal,
      stockClaimed: r.stockClaimed,
    })),
  }
}

export interface ReportAnomaly {
  severity: "warn" | "info"
  message: string
}

/**
 * Derive simple, honest anomalies from gathered data. These are signals
 * an organizer scans for in a post-mortem, not inferences:
 *   - checkpoints that recorded zero scans (dead station or bad signage)
 *   - rewards that ran out of stock (demand exceeded supply)
 *   - finishers who never reached the prize desk (badges, no redemptions)
 */
export function deriveReportAnomalies(
  data: EventReportData
): ReportAnomaly[] {
  const anomalies: ReportAnomaly[] = []

  const deadCheckpoints = data.checkpoints.filter((c) => c.scans === 0)
  for (const cp of deadCheckpoints) {
    anomalies.push({
      severity: "warn",
      message: `Checkpoint "${cp.name}" recorded zero scans.`,
    })
  }

  const depleted = data.rewards.filter(
    (r) => r.stockTotal !== null && r.stockClaimed >= r.stockTotal
  )
  for (const r of depleted) {
    anomalies.push({
      severity: "warn",
      message: `Reward "${r.name}" is out of stock (${r.stockClaimed}/${r.stockTotal} claimed).`,
    })
  }

  if (data.totals.finishers > 0 && data.totals.redemptions === 0) {
    anomalies.push({
      severity: "info",
      message: `${data.totals.finishers} finisher${
        data.totals.finishers === 1 ? "" : "s"
      } minted a badge but no rewards were redeemed at the prize desk.`,
    })
  }

  return anomalies
}

function formatDate(d: Date | null): string {
  if (!d) return "—"
  return d.toISOString().slice(0, 10)
}

/**
 * Pure: gathered data + an injected `now` → a Markdown report string.
 * No clock, no I/O — given the same inputs it always returns the same
 * string, which is what the unit test pins.
 */
export function buildEventReportMarkdown(
  data: EventReportData,
  opts: { now: Date }
): string {
  const { event, totals, checkpoints: cps, rewards: rws } = data
  const anomalies = deriveReportAnomalies(data)

  const completionRate =
    totals.players > 0
      ? Math.round((totals.finishers / totals.players) * 100)
      : 0

  const lines: string[] = []

  lines.push(`# ${event.name} — Event Report`)
  lines.push("")
  lines.push(`Generated ${opts.now.toISOString()}`)
  lines.push("")
  lines.push(`- Venue: ${event.venue ?? "—"}`)
  lines.push(`- Network: ${event.network}`)
  lines.push(`- Status: ${event.status}`)
  lines.push(
    `- Dates: ${formatDate(event.datesStart)} → ${formatDate(event.datesEnd)}`
  )
  lines.push("")

  lines.push("## Totals")
  lines.push("")
  lines.push("| Metric | Value |")
  lines.push("| --- | ---: |")
  lines.push(`| Players started | ${totals.players} |`)
  lines.push(`| Finishers (badge minted) | ${totals.finishers} |`)
  lines.push(`| Completion rate | ${completionRate}% |`)
  lines.push(`| Badge mints | ${totals.badgeMints} |`)
  lines.push(`| Sponsor booth visits | ${totals.sponsorVisits} |`)
  lines.push(`| Reward redemptions | ${totals.redemptions} |`)
  lines.push("")

  lines.push("## Sponsor booth visits per checkpoint")
  lines.push("")
  if (cps.length === 0) {
    lines.push("_No checkpoints configured._")
  } else {
    lines.push("| # | Checkpoint | Sponsor | Scans |")
    lines.push("| ---: | --- | --- | ---: |")
    for (const cp of cps) {
      lines.push(
        `| ${cp.orderIndex} | ${cp.name} | ${
          cp.sponsorName ?? "—"
        } | ${cp.scans} |`
      )
    }
  }
  lines.push("")

  lines.push("## Rewards")
  lines.push("")
  if (rws.length === 0) {
    lines.push("_No rewards configured._")
  } else {
    lines.push("| Reward | Claimed | Stock |")
    lines.push("| --- | ---: | ---: |")
    for (const r of rws) {
      lines.push(
        `| ${r.name} | ${r.stockClaimed} | ${
          r.stockTotal === null ? "unlimited" : r.stockTotal
        } |`
      )
    }
  }
  lines.push("")

  lines.push("## Anomalies")
  lines.push("")
  if (anomalies.length === 0) {
    lines.push("None detected. Every checkpoint saw traffic and no reward sold out.")
  } else {
    for (const a of anomalies) {
      const tag = a.severity === "warn" ? "⚠" : "ℹ"
      lines.push(`- ${tag} ${a.message}`)
    }
  }
  lines.push("")

  return lines.join("\n")
}

/**
 * Convenience: gather + render in one call for a route handler. Returns
 * null when the event doesn't exist so the caller can 404.
 */
export async function generateEventReport(
  eventId: string,
  opts: { now: Date; db?: Db } = { now: new Date() }
): Promise<{ filename: string; markdown: string } | null> {
  const db = opts.db ?? defaultDb
  const data = await gatherEventReportData(db, eventId)
  if (!data) return null
  const markdown = buildEventReportMarkdown(data, { now: opts.now })
  const slug = data.event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
  const stamp = opts.now.toISOString().slice(0, 10)
  return { filename: `treasureloop-report-${slug}-${stamp}.md`, markdown }
}
