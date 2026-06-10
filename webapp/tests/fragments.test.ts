import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"

import { auditLog, checkpoints, fragments } from "@/db/schema"
import {
  FRAGMENT_ALPHABET,
  FRAGMENT_CODE_LENGTH,
  generateShortCode,
  normalizeShortCode,
} from "@/lib/fragments"
import {
  __resetStoreDb,
  __setStoreDb,
  combineFragments,
  issueFragment,
  pickFragmentKind,
  recordScan,
} from "@/lib/player-store"

import { newTestDb, seedTestEvent } from "./db-utils"

const WALLET_A = "0x1111111111111111111111111111111111111111" as const
const WALLET_B = "0x2222222222222222222222222222222222222222" as const
const WALLET_C = "0x3333333333333333333333333333333333333333" as const

let handle: Awaited<ReturnType<typeof newTestDb>>
let eventId: string
let pairCheckpointId: string

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db)
  const seeded = await seedTestEvent(handle.db, 3)
  eventId = seeded.event.id
  pairCheckpointId = seeded.checkpointIds[0]
  // Mark the first checkpoint as a pair checkpoint.
  await handle.db
    .update(checkpoints)
    .set({ clueType: "pair" })
    .where(eq(checkpoints.id, pairCheckpointId))
})

afterEach(() => {
  __resetStoreDb()
})

describe("fragment code alphabet", () => {
  it("excludes ambiguous glyphs and is fixed length", () => {
    expect(FRAGMENT_ALPHABET).not.toMatch(/[01ILO]/)
    const code = generateShortCode()
    expect(code).toHaveLength(FRAGMENT_CODE_LENGTH)
    for (const ch of code) expect(FRAGMENT_ALPHABET).toContain(ch)
  })

  it("normalizes case and separators", () => {
    expect(normalizeShortCode(" ab-cd ")).toBe("ABCD")
  })
})

describe("pickFragmentKind balancing", () => {
  it("alternates A/B when balanced", () => {
    expect(pickFragmentKind({ unpairedA: 0, unpairedB: 0 })).toBe("A")
    expect(pickFragmentKind({ unpairedA: 1, unpairedB: 0 })).toBe("B")
    expect(pickFragmentKind({ unpairedA: 1, unpairedB: 1 })).toBe("A")
  })

  it("drains the surplus kind when skew reaches 3", () => {
    expect(pickFragmentKind({ unpairedA: 3, unpairedB: 0 })).toBe("B")
    expect(pickFragmentKind({ unpairedA: 0, unpairedB: 3 })).toBe("A")
  })
})

describe("issueFragment", () => {
  it("issues a fragment and is idempotent on re-scan", async () => {
    const first = await issueFragment({
      eventId,
      wallet: WALLET_A,
      checkpointId: pairCheckpointId,
    })
    expect(first).not.toBeNull()
    const second = await issueFragment({
      eventId,
      wallet: WALLET_A,
      checkpointId: pairCheckpointId,
    })
    expect(second?.shortCode).toBe(first?.shortCode)
    expect(second?.kind).toBe(first?.kind)

    const rows = await handle.db
      .select()
      .from(fragments)
      .where(eq(fragments.checkpointId, pairCheckpointId))
    expect(rows).toHaveLength(1)
  })

  it("balances A then B across players", async () => {
    const a = await issueFragment({
      eventId,
      wallet: WALLET_A,
      checkpointId: pairCheckpointId,
    })
    const b = await issueFragment({
      eventId,
      wallet: WALLET_B,
      checkpointId: pairCheckpointId,
    })
    expect(a?.kind).toBe("A")
    expect(b?.kind).toBe("B")
  })

  it("returns null for a non-pair checkpoint", async () => {
    const seeded = await seedTestEvent(handle.db, 1)
    const scanCp = seeded.checkpointIds[0]
    const result = await issueFragment({
      eventId: seeded.event.id,
      wallet: WALLET_A,
      checkpointId: scanCp,
    })
    expect(result).toBeNull()
  })
})

describe("combineFragments", () => {
  async function codeFor(wallet: string): Promise<string> {
    const f = await issueFragment({
      eventId,
      wallet: wallet as `0x${string}`,
      checkpointId: pairCheckpointId,
    })
    return f!.shortCode
  }

  it("completes both players on a complementary pair", async () => {
    await codeFor(WALLET_A) // kind A
    const bCode = await codeFor(WALLET_B) // kind B

    const result = await combineFragments({
      eventId,
      wallet: WALLET_A,
      enteredCode: bCode,
    })
    expect(result.ok).toBe(true)

    // Both fragments paired.
    const rows = await handle.db
      .select()
      .from(fragments)
      .where(eq(fragments.checkpointId, pairCheckpointId))
    expect(rows.every((r) => r.pairedAt !== null)).toBe(true)

    // A pair audit row was written.
    const audits = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.fragment_paired"))
    expect(audits).toHaveLength(1)
  })

  it("rejects pairing with your own code", async () => {
    const aCode = await codeFor(WALLET_A)
    const result = await combineFragments({
      eventId,
      wallet: WALLET_A,
      enteredCode: aCode,
    })
    expect(result).toEqual({ ok: false, reason: "same-player" })
  })

  it("rejects two fragments of the same kind", async () => {
    await codeFor(WALLET_A) // A
    await codeFor(WALLET_B) // B
    // Force C to also be A by pairing A+B first is complex; instead test
    // not-complementary by entering a code that resolves to the same kind.
    // WALLET_A holds A; entering WALLET_A's own would be same-player, so
    // create a second A via a fresh balanced state is non-trivial. Cover
    // not-complementary directly: pair A+B, then a leftover same-kind try.
    const cCode = await codeFor(WALLET_C) // balancing → A (after A,B issued, totals 1/1 → A)
    // WALLET_C now holds A. WALLET_A also holds A → not complementary.
    const result = await combineFragments({
      eventId,
      wallet: WALLET_A,
      enteredCode: cCode,
    })
    expect(result).toEqual({ ok: false, reason: "not-complementary" })
  })

  it("rejects an unknown code", async () => {
    await codeFor(WALLET_A)
    const result = await combineFragments({
      eventId,
      wallet: WALLET_A,
      enteredCode: "ZZZZZ",
    })
    expect(result).toEqual({ ok: false, reason: "unknown-code" })
  })

  it("rejects when already paired", async () => {
    await codeFor(WALLET_A)
    const bCode = await codeFor(WALLET_B)
    await combineFragments({ eventId, wallet: WALLET_A, enteredCode: bCode })
    // A second attempt by A: A's only fragment is now paired.
    const again = await combineFragments({
      eventId,
      wallet: WALLET_A,
      enteredCode: bCode,
    })
    expect(again.ok).toBe(false)
  })

  it("records the checkpoint scan for both wallets via recordScan path", async () => {
    await codeFor(WALLET_A)
    const bCode = await codeFor(WALLET_B)
    await combineFragments({ eventId, wallet: WALLET_A, enteredCode: bCode })
    // recordScan is idempotent; a follow-up scan of the same pair cp by A
    // should already be counted (scanned set includes the pair checkpoint).
    const scanned = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.scanned"))
    // Two scanned rows: one per wallet for the pair checkpoint.
    expect(scanned.length).toBeGreaterThanOrEqual(2)
    void recordScan
  })
})
