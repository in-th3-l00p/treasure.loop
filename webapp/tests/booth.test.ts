import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getAddress, type Address } from "viem"
import { and, eq } from "drizzle-orm"

import {
  __resetStoreDb,
  __setStoreDb,
  getProgress,
  isCheckpointOffline,
  recordScan,
} from "@/lib/player-store"
import { auditLog, checkpoints, staffAlerts } from "@/db/schema"

import { newTestDb, seedTestEvent } from "./db-utils"

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]

const WALLET_A: Address = getAddress(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
)

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db as unknown as never)
  const seeded = await seedTestEvent(handle.db, 3)
  eventId = seeded.event.id
  checkpointIds = seeded.checkpointIds
})

afterEach(async () => {
  __resetStoreDb()
  await handle.client.close()
})

describe("checkpoint pause (offline)", () => {
  it("seeded checkpoints default to not-offline", async () => {
    for (const id of checkpointIds) {
      expect(await isCheckpointOffline(eventId, id)).toBe(false)
    }
  })

  it("reports offline once status is set to 'offline'", async () => {
    await handle.db
      .update(checkpoints)
      .set({ status: "offline" })
      .where(eq(checkpoints.id, checkpointIds[0]))

    expect(await isCheckpointOffline(eventId, checkpointIds[0])).toBe(true)
    // Other checkpoints stay open.
    expect(await isCheckpointOffline(eventId, checkpointIds[1])).toBe(false)
  })

  it("rejects a scan at an offline checkpoint and records nothing", async () => {
    await handle.db
      .update(checkpoints)
      .set({ status: "offline" })
      .where(eq(checkpoints.id, checkpointIds[0]))

    const result = await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    expect(result).toBeNull()

    // No scan row and therefore no progress for this wallet.
    expect(await getProgress(eventId, WALLET_A)).toBeNull()

    // No player.scanned audit row was written for the rejected scan.
    const scannedRows = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.scanned"))
    expect(scannedRows).toHaveLength(0)
  })

  it("accepts the scan again after the checkpoint resumes", async () => {
    await handle.db
      .update(checkpoints)
      .set({ status: "offline" })
      .where(eq(checkpoints.id, checkpointIds[0]))
    expect(
      await recordScan({
        eventId,
        wallet: WALLET_A,
        checkpointId: checkpointIds[0],
      })
    ).toBeNull()

    await handle.db
      .update(checkpoints)
      .set({ status: "healthy" })
      .where(eq(checkpoints.id, checkpointIds[0]))

    const result = await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    expect(result).not.toBeNull()
    expect(result!.scanned).toEqual([checkpointIds[0]])
  })
})

describe("staff alerts", () => {
  const RAISER = "user_staff_1"
  const ACKER = "user_org_1"

  it("inserts an open alert with the expected defaults", async () => {
    const [row] = await handle.db
      .insert(staffAlerts)
      .values({
        eventId,
        checkpointId: checkpointIds[0],
        raisedBy: RAISER,
        message: "Queue is huge",
      })
      .returning()

    expect(row.status).toBe("open")
    expect(row.kind).toBe("help")
    expect(row.message).toBe("Queue is huge")
    expect(row.acknowledgedAt).toBeNull()
    expect(row.acknowledgedBy).toBeNull()
    expect(row.createdAt).toBeInstanceOf(Date)
  })

  it("transitions an open alert to acknowledged", async () => {
    const [row] = await handle.db
      .insert(staffAlerts)
      .values({
        eventId,
        checkpointId: checkpointIds[0],
        raisedBy: RAISER,
      })
      .returning()

    const acknowledgedAt = new Date()
    const updated = await handle.db
      .update(staffAlerts)
      .set({
        status: "acknowledged",
        acknowledgedAt,
        acknowledgedBy: ACKER,
      })
      .where(
        and(eq(staffAlerts.id, row.id), eq(staffAlerts.status, "open"))
      )
      .returning()

    expect(updated).toHaveLength(1)
    expect(updated[0].status).toBe("acknowledged")
    expect(updated[0].acknowledgedBy).toBe(ACKER)
    expect(updated[0].acknowledgedAt).toBeInstanceOf(Date)
  })

  it("does not re-acknowledge an already-acknowledged alert", async () => {
    const [row] = await handle.db
      .insert(staffAlerts)
      .values({
        eventId,
        checkpointId: checkpointIds[0],
        raisedBy: RAISER,
      })
      .returning()

    // First acknowledge succeeds.
    const first = await handle.db
      .update(staffAlerts)
      .set({ status: "acknowledged", acknowledgedBy: ACKER })
      .where(
        and(eq(staffAlerts.id, row.id), eq(staffAlerts.status, "open"))
      )
      .returning()
    expect(first).toHaveLength(1)

    // Second acknowledge matches nothing (status no longer 'open').
    const second = await handle.db
      .update(staffAlerts)
      .set({ status: "acknowledged", acknowledgedBy: "user_other" })
      .where(
        and(eq(staffAlerts.id, row.id), eq(staffAlerts.status, "open"))
      )
      .returning()
    expect(second).toHaveLength(0)
  })

  it("scopes open alerts by event and status", async () => {
    await handle.db.insert(staffAlerts).values([
      { eventId, checkpointId: checkpointIds[0], raisedBy: RAISER },
      {
        eventId,
        checkpointId: checkpointIds[1],
        raisedBy: RAISER,
        status: "acknowledged",
      },
    ])

    const open = await handle.db
      .select()
      .from(staffAlerts)
      .where(
        and(
          eq(staffAlerts.eventId, eventId),
          eq(staffAlerts.status, "open")
        )
      )
    expect(open).toHaveLength(1)
    expect(open[0].checkpointId).toBe(checkpointIds[0])
  })
})
