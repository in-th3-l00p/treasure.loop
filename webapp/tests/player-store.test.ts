import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getAddress, type Address } from "viem"

import { checkpoints } from "@/lib/mock-data"
import {
  hasFinishedLoop,
  isValidCheckpoint,
  playerStore,
  toPublicProgress,
  totalCheckpoints,
} from "@/lib/player-store"

const WALLET_A: Address = getAddress(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
)
const WALLET_B: Address = getAddress(
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
)

beforeEach(() => {
  playerStore.reset()
})
afterEach(() => {
  playerStore.reset()
})

describe("checkpoint validation", () => {
  it("accepts every shipped checkpoint id", () => {
    for (const cp of checkpoints) {
      expect(isValidCheckpoint(cp.id)).toBe(true)
    }
  })
  it("rejects bogus checkpoint ids", () => {
    expect(isValidCheckpoint("CP-99")).toBe(false)
    expect(isValidCheckpoint("")).toBe(false)
    expect(isValidCheckpoint("not-a-checkpoint")).toBe(false)
  })
  it("reports the full event size", () => {
    expect(totalCheckpoints()).toBe(checkpoints.length)
  })
})

describe("ensure()", () => {
  it("creates a fresh record on first call", () => {
    expect(playerStore.get(WALLET_A)).toBeNull()
    const p = playerStore.ensure(WALLET_A)
    expect(p.address).toBe(WALLET_A)
    expect(p.scanned).toEqual([])
    expect(p.badgeMintedAt).toBeNull()
    expect(p.lastScanAt).toBeNull()
  })
  it("returns the same record on subsequent calls", () => {
    const a = playerStore.ensure(WALLET_A)
    const b = playerStore.ensure(WALLET_A)
    expect(a).toBe(b)
  })
  it("normalizes addresses to checksummed form", () => {
    const lower = WALLET_A.toLowerCase() as Address
    const p = playerStore.ensure(lower)
    expect(p.address).toBe(WALLET_A) // checksummed
    expect(playerStore.get(lower)).toBe(p)
  })
})

describe("scan()", () => {
  it("records a valid checkpoint", () => {
    const p = playerStore.scan(WALLET_A, checkpoints[0].id)
    expect(p).not.toBeNull()
    expect(p!.scanned).toEqual([checkpoints[0].id])
    expect(p!.lastScanAt).toBeGreaterThan(0)
  })

  it("is idempotent on the same checkpoint", () => {
    playerStore.scan(WALLET_A, checkpoints[0].id)
    const second = playerStore.scan(WALLET_A, checkpoints[0].id)
    expect(second!.scanned).toEqual([checkpoints[0].id])
  })

  it("rejects unknown checkpoints", () => {
    expect(playerStore.scan(WALLET_A, "CP-XX")).toBeNull()
    expect(playerStore.scan(WALLET_A, "")).toBeNull()
  })

  it("keeps progress per wallet — no cross-contamination", () => {
    playerStore.scan(WALLET_A, checkpoints[0].id)
    playerStore.scan(WALLET_B, checkpoints[1].id)
    expect(playerStore.get(WALLET_A)!.scanned).toEqual([checkpoints[0].id])
    expect(playerStore.get(WALLET_B)!.scanned).toEqual([checkpoints[1].id])
  })

  it("preserves scan order", () => {
    for (const cp of checkpoints) playerStore.scan(WALLET_A, cp.id)
    expect(playerStore.get(WALLET_A)!.scanned).toEqual(
      checkpoints.map((c) => c.id)
    )
  })
})

describe("hasFinishedLoop()", () => {
  it("false when not every checkpoint is scanned", () => {
    for (const cp of checkpoints.slice(0, -1)) {
      playerStore.scan(WALLET_A, cp.id)
    }
    const p = playerStore.get(WALLET_A)!
    expect(hasFinishedLoop(p)).toBe(false)
  })
  it("true once every checkpoint is scanned", () => {
    for (const cp of checkpoints) playerStore.scan(WALLET_A, cp.id)
    const p = playerStore.get(WALLET_A)!
    expect(hasFinishedLoop(p)).toBe(true)
  })
})

describe("recordBadgeMint()", () => {
  it("rejects players who haven't finished the loop", () => {
    playerStore.ensure(WALLET_A)
    expect(playerStore.recordBadgeMint(WALLET_A)).toBeNull()
  })
  it("records the mint timestamp when eligible", () => {
    for (const cp of checkpoints) playerStore.scan(WALLET_A, cp.id)
    const p = playerStore.recordBadgeMint(WALLET_A)
    expect(p).not.toBeNull()
    expect(p!.badgeMintedAt).toBeGreaterThan(0)
  })
  it("rejects double-mint", () => {
    for (const cp of checkpoints) playerStore.scan(WALLET_A, cp.id)
    expect(playerStore.recordBadgeMint(WALLET_A)).not.toBeNull()
    expect(playerStore.recordBadgeMint(WALLET_A)).toBeNull()
  })
})

describe("toPublicProgress()", () => {
  it("never leaks internal fields", () => {
    playerStore.scan(WALLET_A, checkpoints[0].id)
    const p = playerStore.get(WALLET_A)!
    const pub = toPublicProgress(p)
    expect(pub).toEqual({
      address: WALLET_A,
      scanned: [checkpoints[0].id],
      total: checkpoints.length,
      finished: false,
      badgeMintedAt: null,
      startedAt: p.startedAt,
      lastScanAt: p.lastScanAt,
    })
  })

  it("reports finished=true after the loop closes", () => {
    for (const cp of checkpoints) playerStore.scan(WALLET_A, cp.id)
    const pub = toPublicProgress(playerStore.get(WALLET_A)!)
    expect(pub.finished).toBe(true)
  })
})
