import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getAddress, type Address } from "viem"

import {
  __resetStoreDb,
  __setStoreDb,
  ensurePlayer,
  getProgress,
  isValidCheckpoint,
  recordBadgeMint,
  recordScan,
  totalCheckpoints,
} from "@/lib/player-store"

import { newTestDb, seedTestEvent } from "./db-utils"

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let checkpointIds: string[]

const WALLET_A: Address = getAddress(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
)
const WALLET_B: Address = getAddress(
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
)

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db as unknown as never)
  const seeded = await seedTestEvent(handle.db, 5)
  eventId = seeded.event.id
  checkpointIds = seeded.checkpointIds
})

afterEach(async () => {
  __resetStoreDb()
  await handle.client.close()
})

describe("isValidCheckpoint", () => {
  it("accepts every seeded checkpoint id", async () => {
    for (const id of checkpointIds) {
      expect(await isValidCheckpoint(eventId, id)).toBe(true)
    }
  })
  it("rejects bogus checkpoint ids", async () => {
    expect(await isValidCheckpoint(eventId, "cp_does_not_exist")).toBe(false)
    expect(await isValidCheckpoint(eventId, "")).toBe(false)
  })
  it("rejects checkpoints from a different event", async () => {
    const other = await seedTestEvent(handle.db, 1)
    expect(await isValidCheckpoint(eventId, other.checkpointIds[0])).toBe(
      false
    )
  })
})

describe("totalCheckpoints", () => {
  it("counts the seeded checkpoints", async () => {
    expect(await totalCheckpoints(eventId)).toBe(5)
  })
})

describe("ensurePlayer", () => {
  it("creates a player on first call", async () => {
    const p = await ensurePlayer(eventId, WALLET_A)
    expect(p.wallet).toBe(WALLET_A)
    expect(p.startedAt).toBeGreaterThan(0)
    expect(p.lastScanAt).toBeNull()
  })
  it("returns the same player id on subsequent calls", async () => {
    const a = await ensurePlayer(eventId, WALLET_A)
    const b = await ensurePlayer(eventId, WALLET_A)
    expect(a.id).toBe(b.id)
  })
  it("normalizes lowercase addresses to checksummed form", async () => {
    const lower = WALLET_A.toLowerCase() as Address
    const p = await ensurePlayer(eventId, lower)
    expect(p.wallet).toBe(WALLET_A)
  })
  it("scopes by event — same wallet, different event = different player", async () => {
    const other = await seedTestEvent(handle.db, 3)
    const a = await ensurePlayer(eventId, WALLET_A)
    const b = await ensurePlayer(other.event.id, WALLET_A)
    expect(a.id).not.toBe(b.id)
  })
})

describe("recordScan", () => {
  it("records a valid checkpoint", async () => {
    const p = await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    expect(p).not.toBeNull()
    expect(p!.scanned).toEqual([checkpointIds[0]])
    expect(p!.lastScanAt).toBeGreaterThan(0)
  })

  it("is idempotent on the same checkpoint", async () => {
    await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    const second = await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    expect(second!.scanned).toEqual([checkpointIds[0]])
  })

  it("rejects unknown checkpoints", async () => {
    expect(
      await recordScan({
        eventId,
        wallet: WALLET_A,
        checkpointId: "cp_xx",
      })
    ).toBeNull()
  })

  it("keeps progress per wallet — no cross-contamination", async () => {
    await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    await recordScan({
      eventId,
      wallet: WALLET_B,
      checkpointId: checkpointIds[1],
    })
    const a = await getProgress(eventId, WALLET_A)
    const b = await getProgress(eventId, WALLET_B)
    expect(a!.scanned).toEqual([checkpointIds[0]])
    expect(b!.scanned).toEqual([checkpointIds[1]])
  })

  it("preserves scan order", async () => {
    for (const id of checkpointIds) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    const p = await getProgress(eventId, WALLET_A)
    expect(p!.scanned).toEqual(checkpointIds)
  })
})

describe("getProgress.finished", () => {
  it("false when not every checkpoint is scanned", async () => {
    for (const id of checkpointIds.slice(0, -1)) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    const p = await getProgress(eventId, WALLET_A)
    expect(p!.finished).toBe(false)
  })
  it("true once every checkpoint is scanned", async () => {
    for (const id of checkpointIds) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    const p = await getProgress(eventId, WALLET_A)
    expect(p!.finished).toBe(true)
  })
})

describe("recordBadgeMint", () => {
  it("rejects players who haven't finished the loop", async () => {
    await ensurePlayer(eventId, WALLET_A)
    expect(
      await recordBadgeMint({
        eventId,
        wallet: WALLET_A,
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
      })
    ).toBeNull()
  })

  it("records the mint timestamp when eligible", async () => {
    for (const id of checkpointIds) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    const p = await recordBadgeMint({
      eventId,
      wallet: WALLET_A,
      txHash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      tokenId: 1,
    })
    expect(p).not.toBeNull()
    expect(p!.badgeMintedAt).toBeGreaterThan(0)
  })

  it("rejects double-mint", async () => {
    for (const id of checkpointIds) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    const first = await recordBadgeMint({
      eventId,
      wallet: WALLET_A,
      txHash:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
    })
    expect(first).not.toBeNull()
    const second = await recordBadgeMint({
      eventId,
      wallet: WALLET_A,
      txHash:
        "0x4444444444444444444444444444444444444444444444444444444444444444",
    })
    expect(second).toBeNull() // second attempt rejected
  })
})

describe("getProgress shape", () => {
  it("returns a stable public shape", async () => {
    await recordScan({
      eventId,
      wallet: WALLET_A,
      checkpointId: checkpointIds[0],
    })
    const p = await getProgress(eventId, WALLET_A)
    expect(p).toMatchObject({
      address: WALLET_A,
      scanned: [checkpointIds[0]],
      total: 5,
      finished: false,
      badgeMintedAt: null,
    })
    expect(typeof p!.startedAt).toBe("number")
    expect(typeof p!.lastScanAt).toBe("number")
  })

  it("returns null for a wallet that never started", async () => {
    expect(await getProgress(eventId, WALLET_B)).toBeNull()
  })
})
