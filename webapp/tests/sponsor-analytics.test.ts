import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { getAddress, type Address } from "viem"

import {
  checkpoints,
  leadConsents,
  players,
  scans,
  shareLinks,
  sponsors,
  sponsorTrafficHourly,
} from "@/db/schema"
import {
  __resetStoreDb,
  __setStoreDb,
  recordScan,
} from "@/lib/player-store"
import {
  leadsToCsv,
  listSponsorLeads,
  rollupSponsorTraffic,
  scopeSponsorsForViewer,
  sponsorHourlyTraffic,
  sponsorTalkThroughCount,
  sponsorVisitCount,
} from "@/lib/sponsor-analytics"
import {
  activeShareLinkForSponsor,
  generateShareToken,
  resolveShareLink,
} from "@/lib/share-links"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * Phase 8 sponsor analytics, exercised against real SQL via pglite.
 * Mirrors the style of `event-report.test.ts` — seed a known event, run
 * the real queries, assert the figures.
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]
let sponsorId: string

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

  // Sponsor owns the FIRST checkpoint (order 1). The next-in-sequence is
  // checkpoint 2 (order 2), used for talk-through.
  const [sponsor] = await handle.db
    .insert(sponsors)
    .values({
      eventId,
      name: "Neon Labs",
      tier: "gold",
      contactEmail: "lead@neon.example",
    })
    .returning()
  sponsorId = sponsor.id
  await handle.db
    .update(checkpoints)
    .set({ sponsorId })
    .where(eq(checkpoints.id, checkpointIds[0]))
})

afterEach(async () => {
  await handle.client.close()
  __resetStoreDb()
})

// ──────────────────────────── lead consent ─────────────────────────

describe("lead consent at scan time", () => {
  beforeEach(() => {
    // recordScan reads the module-level store db; point it at pglite.
    __setStoreDb(handle.db)
  })

  it("records a consent when the player opts in at a sponsor booth", async () => {
    const progress = await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[0],
      shareLead: true,
    })
    expect(progress).not.toBeNull()

    const rows = await handle.db
      .select()
      .from(leadConsents)
      .where(eq(leadConsents.sponsorId, sponsorId))
    expect(rows).toHaveLength(1)
    expect(rows[0].wallet).toBe(getAddress(wallets[0]))
    expect(rows[0].checkpointId).toBe(checkpointIds[0])
  })

  it("records NO consent when the player opts out", async () => {
    await recordScan({
      eventId,
      wallet: wallets[1],
      checkpointId: checkpointIds[0],
      shareLead: false,
    })
    // And a default (undefined) opt-in is also off.
    await recordScan({
      eventId,
      wallet: wallets[2],
      checkpointId: checkpointIds[0],
    })

    const rows = await handle.db.select().from(leadConsents)
    expect(rows).toHaveLength(0)
  })

  it("never records a consent for a non-sponsor checkpoint", async () => {
    await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[1], // no sponsor
      shareLead: true,
    })
    const rows = await handle.db.select().from(leadConsents)
    expect(rows).toHaveLength(0)
  })

  it("the scan still succeeds when consent is withheld", async () => {
    const progress = await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[0],
      shareLead: false,
    })
    expect(progress?.scanned).toContain(checkpointIds[0])
  })

  it("is idempotent on (player, sponsor) across re-scans", async () => {
    await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[0],
      shareLead: true,
    })
    // Re-scan (idempotent on player+checkpoint) opting in again.
    await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[0],
      shareLead: true,
    })
    const rows = await handle.db
      .select()
      .from(leadConsents)
      .where(eq(leadConsents.sponsorId, sponsorId))
    expect(rows).toHaveLength(1)
  })

  it("surfaces opted-in leads and exports them as CSV", async () => {
    __setStoreDb(handle.db)
    await recordScan({
      eventId,
      wallet: wallets[0],
      checkpointId: checkpointIds[0],
      shareLead: true,
    })

    const leads = await listSponsorLeads(handle.db, sponsorId)
    expect(leads).toHaveLength(1)
    expect(leads[0].wallet).toBe(getAddress(wallets[0]))
    expect(leads[0].checkpointName).toBe("Checkpoint 1")

    const csv = leadsToCsv(leads)
    expect(csv).toContain("wallet,checkpoint,consented_at")
    expect(csv).toContain(getAddress(wallets[0]))
    expect(csv).toContain("Checkpoint 1")
  })
})

// ──────────────────────────── talk-through ─────────────────────────

describe("talk-through metric", () => {
  it("counts a wallet that scans the next checkpoint within 10 min", async () => {
    const [p0] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[0] })
      .returning()

    const base = new Date("2026-07-18T10:00:00.000Z")
    // Sponsor checkpoint (order 1) then the next checkpoint (order 2) at
    // +5 minutes — a qualifying talk-through.
    await handle.db.insert(scans).values([
      {
        playerId: p0.id,
        checkpointId: checkpointIds[0],
        createdAt: base,
      },
      {
        playerId: p0.id,
        checkpointId: checkpointIds[1],
        createdAt: new Date(base.getTime() + 5 * 60_000),
      },
    ])

    const count = await sponsorTalkThroughCount(handle.db, sponsorId)
    expect(count).toBe(1)
  })

  it("does NOT count when the next scan is too late", async () => {
    const [p0] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[0] })
      .returning()

    const base = new Date("2026-07-18T10:00:00.000Z")
    await handle.db.insert(scans).values([
      { playerId: p0.id, checkpointId: checkpointIds[0], createdAt: base },
      {
        playerId: p0.id,
        checkpointId: checkpointIds[1],
        createdAt: new Date(base.getTime() + 30 * 60_000), // 30 min later
      },
    ])

    const count = await sponsorTalkThroughCount(handle.db, sponsorId)
    expect(count).toBe(0)
  })

  it("does NOT count a non-sequential scan (skips the next checkpoint)", async () => {
    const [p0] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[0] })
      .returning()

    const base = new Date("2026-07-18T10:00:00.000Z")
    // Scans sponsor cp (order 1) then jumps to checkpoint 3 (order 3),
    // skipping the next-in-sequence checkpoint 2.
    await handle.db.insert(scans).values([
      { playerId: p0.id, checkpointId: checkpointIds[0], createdAt: base },
      {
        playerId: p0.id,
        checkpointId: checkpointIds[2],
        createdAt: new Date(base.getTime() + 5 * 60_000),
      },
    ])

    const count = await sponsorTalkThroughCount(handle.db, sponsorId)
    expect(count).toBe(0)
  })
})

// ──────────────────────────── rollup ──────────────────────────────

describe("hourly rollup", () => {
  beforeEach(async () => {
    const [p0] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[0] })
      .returning()
    const [p1] = await handle.db
      .insert(players)
      .values({ eventId, wallet: wallets[1] })
      .returning()

    const hour = new Date("2026-07-18T10:00:00.000Z")
    // Two scans at the sponsor checkpoint in the same hour bucket.
    await handle.db.insert(scans).values([
      {
        playerId: p0.id,
        checkpointId: checkpointIds[0],
        createdAt: new Date(hour.getTime() + 2 * 60_000),
      },
      {
        playerId: p1.id,
        checkpointId: checkpointIds[0],
        createdAt: new Date(hour.getTime() + 40 * 60_000),
      },
    ])
  })

  it("counts scans into the right hour bucket", async () => {
    const written = await rollupSponsorTraffic(handle.db, eventId)
    expect(written).toBe(1)

    const rows = await handle.db
      .select()
      .from(sponsorTrafficHourly)
      .where(eq(sponsorTrafficHourly.sponsorId, sponsorId))
    expect(rows).toHaveLength(1)
    expect(rows[0].scanCount).toBe(2)
    expect(rows[0].bucketStart.toISOString()).toBe(
      "2026-07-18T10:00:00.000Z"
    )
  })

  it("is idempotent: re-running leaves one row with the same count", async () => {
    await rollupSponsorTraffic(handle.db, eventId)
    await rollupSponsorTraffic(handle.db, eventId)

    const rows = await handle.db
      .select()
      .from(sponsorTrafficHourly)
      .where(eq(sponsorTrafficHourly.sponsorId, sponsorId))
    expect(rows).toHaveLength(1)
    expect(rows[0].scanCount).toBe(2)
  })

  it("the read path prefers the rollup and falls back to live scans", async () => {
    const now = new Date("2026-07-18T11:00:00.000Z")

    // Before rollup: live fallback still sees the 2 scans in the window.
    const live = await sponsorHourlyTraffic(handle.db, sponsorId, {
      hours: 4,
      now,
    })
    expect(live.reduce((s, b) => s + b.scanCount, 0)).toBe(2)

    // After rollup: same total, now served from the rollup table.
    await rollupSponsorTraffic(handle.db, eventId)
    const rolled = await sponsorHourlyTraffic(handle.db, sponsorId, {
      hours: 4,
      now,
    })
    expect(rolled.reduce((s, b) => s + b.scanCount, 0)).toBe(2)
  })
})

// ─────────────────────────── visit count ───────────────────────────

describe("visit count", () => {
  it("counts scans at the sponsor's checkpoints", async () => {
    const rows = await handle.db
      .insert(players)
      .values(wallets.map((w) => ({ eventId, wallet: w })))
      .returning()
    await handle.db.insert(scans).values(
      rows.map((p) => ({ playerId: p.id, checkpointId: checkpointIds[0] }))
    )
    expect(await sponsorVisitCount(handle.db, sponsorId)).toBe(3)
  })
})

// ──────────────────────── privacy scoping ──────────────────────────

describe("scopeSponsorsForViewer", () => {
  const list = [
    { id: "spn_a", contactEmail: "a@x.com" },
    { id: "spn_b", contactEmail: "b@x.com" },
    { id: "spn_c", contactEmail: null },
  ]

  it("organizer sees every sponsor", () => {
    const out = scopeSponsorsForViewer(list, {
      isOrganizer: true,
      viewerEmails: [],
    })
    expect(out).toHaveLength(3)
  })

  it("a sponsor sees only the booth matching their email", () => {
    const out = scopeSponsorsForViewer(list, {
      isOrganizer: false,
      viewerEmails: ["B@X.com"],
    })
    expect(out.map((s) => s.id)).toEqual(["spn_b"])
  })

  it("a sponsor with no match sees nothing", () => {
    const out = scopeSponsorsForViewer(list, {
      isOrganizer: false,
      viewerEmails: ["nobody@x.com"],
    })
    expect(out).toHaveLength(0)
  })
})

// ──────────────────────────── share links ──────────────────────────

describe("share links", () => {
  it("validity flips on revoke", async () => {
    const token = generateShareToken()
    await handle.db.insert(shareLinks).values({
      token,
      eventId,
      sponsorId,
      createdBy: "user_test",
    })

    // Valid while not revoked.
    const ok = await resolveShareLink(handle.db, token, sponsorId)
    expect(ok).not.toBeNull()
    expect(ok?.sponsorName).toBe("Neon Labs")

    const active = await activeShareLinkForSponsor(handle.db, sponsorId)
    expect(active?.token).toBe(token)

    // Revoke → resolve returns null, no active link.
    await handle.db
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(eq(shareLinks.token, token))

    expect(await resolveShareLink(handle.db, token, sponsorId)).toBeNull()
    expect(await activeShareLinkForSponsor(handle.db, sponsorId)).toBeNull()
  })

  it("rejects a token that doesn't match the requested sponsor", async () => {
    const token = generateShareToken()
    await handle.db.insert(shareLinks).values({
      token,
      eventId,
      sponsorId,
      createdBy: "user_test",
    })
    expect(
      await resolveShareLink(handle.db, token, "spn_other")
    ).toBeNull()
  })

  it("generates unguessable, unique tokens", () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(12)
  })
})
