import { describe, expect, it } from "vitest"

import {
  currentCode,
  generateCheckpointSecret,
  secondsUntilNext,
  verifyCheckpointCode,
} from "@/lib/checkpoint-codes"

describe("generateCheckpointSecret", () => {
  it("returns 32-char base32 strings (~160 bits)", () => {
    const s = generateCheckpointSecret()
    expect(s).toMatch(/^[A-Z2-7]+=*$/)
    expect(s.replace(/=+$/, "").length).toBe(32)
  })
  it("emits unique secrets", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 32; i++) {
      seen.add(generateCheckpointSecret())
    }
    expect(seen.size).toBe(32)
  })
})

describe("currentCode", () => {
  it("returns a 6-digit numeric string", () => {
    const code = currentCode(generateCheckpointSecret())
    expect(code).toMatch(/^\d{6}$/)
  })
  it("two checkpoints with different secrets produce different codes", () => {
    const a = generateCheckpointSecret()
    const b = generateCheckpointSecret()
    expect(currentCode(a)).not.toBe(currentCode(b))
  })
})

describe("verifyCheckpointCode", () => {
  it("accepts the freshly-generated current code", () => {
    const secret = generateCheckpointSecret()
    expect(verifyCheckpointCode(secret, currentCode(secret))).toBe(true)
  })
  it("rejects a code from a different secret", () => {
    const a = generateCheckpointSecret()
    const b = generateCheckpointSecret()
    expect(verifyCheckpointCode(a, currentCode(b))).toBe(false)
  })
  it("rejects malformed inputs", () => {
    const secret = generateCheckpointSecret()
    expect(verifyCheckpointCode(secret, "")).toBe(false)
    expect(verifyCheckpointCode(secret, "abc")).toBe(false)
    expect(verifyCheckpointCode(secret, "12345")).toBe(false)
    expect(verifyCheckpointCode(secret, "1234567")).toBe(false)
  })

  it("tolerates spaces and dashes in the submitted code", () => {
    const secret = generateCheckpointSecret()
    const code = currentCode(secret)
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
    const dashed = `${code.slice(0, 3)}-${code.slice(3)}`
    expect(verifyCheckpointCode(secret, spaced)).toBe(true)
    expect(verifyCheckpointCode(secret, dashed)).toBe(true)
  })
  it("rejects when secret is missing", () => {
    expect(verifyCheckpointCode("", "123456")).toBe(false)
  })
  it("rejects an obviously-wrong six-digit string", () => {
    const secret = generateCheckpointSecret()
    // Pick a code 5 windows away — far outside the ±1 tolerance.
    const farFutureCode = "000000"
    expect(verifyCheckpointCode(secret, farFutureCode)).toBe(false)
  })
})

describe("secondsUntilNext", () => {
  it("falls within (0, 30]", () => {
    const r = secondsUntilNext()
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThanOrEqual(30)
  })
})
