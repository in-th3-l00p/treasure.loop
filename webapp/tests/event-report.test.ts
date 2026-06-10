import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { getAddress, type Address } from "viem"

import {
  badgeMints,
  checkpoints,
  players,
  redemptionClaims,
  rewards,
  scans,
  sponsors,
} from "@/db/schema"
import {
  buildEventReportMarkdown,
  deriveReportAnomalies,
  gatherEventReportData,
  generateEventReport,
} from "@/lib/event-report"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * The report generator must surface real totals from a seeded event and
 * flag honest anomalies (dead checkpoints, depleted rewards). We seed a
 * pglite event with known traffic and assert the figures appear, then
 * pin the pure markdown builder against an injected `now`.
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]

const wallets: Address[] = [
  getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
  getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
]

beforeEach(async () => {
  handle = await newTestDb()
  const seed = await seedTestEvent(handle.db, 4)
  eventId = seed.event.id
  checkpointIds = seed.checkpointIds
  const db = handle.db

  // Sponsor on the first checkpoint, so the per-checkpoint section has a
  // sponsor name to show.
  const [sponsor] = await db
    .insert(sponsors)
    .values({ eventId, name: "Neon Labs", tier: "gold" })
    .returning()
  await db
    .update(checkpoints)
    .set({ sponsorId: sponsor.id })
    .where(eq(checkpoints.id, checkpointIds[0]))

  // Three players, all "started".
  const playerRows = await db
    .insert(players)
    .values(
      wallets.map((w) => ({ eventId, wallet: w, lastScanAt: new Date() }))
    )
    .returning()

  // Scans: checkpoint 0 gets 3, checkpoint 1 gets 2, checkpoint 2 gets 1,
  // checkpoint 3 gets ZERO (the dead-checkpoint anomaly).
  const scanPlan: { checkpoint: number; players: number[] }[] = [
    { checkpoint: 0, players: [0, 1, 2] },
    { checkpoint: 1, players: [0, 1] },
    { checkpoint: 2, players: [0] },
  ]
  for (const plan of scanPlan) {
    await db.insert(scans).values(
      plan.players.map((pi) => ({
        playerId: playerRows[pi].id,
        checkpointId: checkpointIds[plan.checkpoint],
      }))
    )
  }

  // Two finishers minted badges.
  await db.insert(badgeMints).values([
    { playerId: playerRows[0].id, txHash: `0x${"1".repeat(64)}` },
    { playerId: playerRows[1].id, txHash: `0x${"2".repeat(64)}` },
  ])

  // A reward that is fully depleted (1/1) → out-of-stock anomaly, plus
  // one open reward.
  const [limited] = await db
    .insert(rewards)
    .values({
      eventId,
      name: "Ledger Nano raffle",
      stockTotal: 1,
      stockClaimed: 1,
    })
    .returning()
  await db
    .insert(rewards)
    .values({ eventId, name: "Conference merch pack", stockTotal: null })

  // One redemption against the depleted reward.
  await db.insert(redemptionClaims).values({
    playerId: playerRows[0].id,
    rewardId: limited.id,
  })
})

afterEach(async () => {
  await handle.client.close()
})

describe("event report data", () => {
  it("gathers real totals scoped to the event", async () => {
    const data = await gatherEventReportData(handle.db, eventId)
    expect(data).not.toBeNull()
    if (!data) return

    expect(data.totals.players).toBe(3)
    expect(data.totals.finishers).toBe(2)
    expect(data.totals.badgeMints).toBe(2)
    // 3 + 2 + 1 scans across checkpoints.
    expect(data.totals.sponsorVisits).toBe(6)
    expect(data.totals.redemptions).toBe(1)

    // Per-checkpoint scans, in order.
    const scansByOrder = data.checkpoints
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => c.scans)
    expect(scansByOrder).toEqual([3, 2, 1, 0])
    expect(data.checkpoints[0].sponsorName).toBe("Neon Labs")
  })

  it("returns null for an unknown event", async () => {
    expect(await gatherEventReportData(handle.db, "evt_missing")).toBeNull()
  })

  it("flags dead checkpoints and depleted rewards as anomalies", async () => {
    const data = await gatherEventReportData(handle.db, eventId)
    if (!data) throw new Error("no data")
    const anomalies = deriveReportAnomalies(data)
    const messages = anomalies.map((a) => a.message)

    expect(messages).toContainEqual(
      expect.stringContaining("Checkpoint 4")
    )
    expect(messages.some((m) => m.includes("zero scans"))).toBe(true)
    expect(
      messages.some(
        (m) => m.includes("Ledger Nano raffle") && m.includes("out of stock")
      )
    ).toBe(true)
  })
})

describe("event report markdown", () => {
  it("renders a deterministic markdown report with key totals", async () => {
    const data = await gatherEventReportData(handle.db, eventId)
    if (!data) throw new Error("no data")

    const now = new Date("2026-07-19T18:00:00.000Z")
    const md = buildEventReportMarkdown(data, { now })

    // Header + generated-at injected (not Date.now()).
    expect(md).toContain(`# ${data.event.name} — Event Report`)
    expect(md).toContain("Generated 2026-07-19T18:00:00.000Z")

    // Totals appear as table rows.
    expect(md).toContain("| Players started | 3 |")
    expect(md).toContain("| Finishers (badge minted) | 2 |")
    expect(md).toContain("| Sponsor booth visits | 6 |")
    expect(md).toContain("| Reward redemptions | 1 |")

    // Per-checkpoint sponsor visit appears.
    expect(md).toContain("Neon Labs")

    // Anomalies section is present and not the empty fallback.
    expect(md).toContain("## Anomalies")
    expect(md).not.toContain("None detected.")
    expect(md).toContain("zero scans")
  })

  it("generateEventReport returns a slugged filename + markdown", async () => {
    const now = new Date("2026-07-19T18:00:00.000Z")
    const out = await generateEventReport(eventId, { now, db: handle.db })
    expect(out).not.toBeNull()
    if (!out) return
    expect(out.filename).toMatch(/^treasureloop-report-.+-2026-07-19\.md$/)
    expect(out.markdown).toContain("# ")
  })
})
