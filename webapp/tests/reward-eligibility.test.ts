import { describe, expect, it } from "vitest"

import {
  type EligibilityContext,
  DEFAULT_RULE,
  describeRule,
  evaluateEligibility,
  normalizeRule,
} from "@/lib/reward-eligibility"

/**
 * Pure-function tests for the reward eligibility engine. No DB, no chain —
 * the engine takes a fully-derived context so it can be exercised directly.
 */

const holder: EligibilityContext = {
  holdsBadge: true,
  mintRank: 5,
  scanCount: 7,
}

describe("evaluateEligibility — badge precondition", () => {
  it("rejects any rule when the wallet doesn't hold a badge", () => {
    for (const rule of [
      { type: "any-minted" as const },
      { type: "first-n-mints" as const, n: 100 },
      { type: "min-scans" as const, n: 1 },
    ]) {
      const res = evaluateEligibility(rule, {
        holdsBadge: false,
        mintRank: 1,
        scanCount: 99,
      })
      expect(res.eligible).toBe(false)
      expect(res.reason).toMatch(/does not hold/i)
    }
  })
})

describe("evaluateEligibility — any-minted", () => {
  it("is eligible for any badge holder", () => {
    const res = evaluateEligibility({ type: "any-minted" }, holder)
    expect(res.eligible).toBe(true)
    expect(res.reason).toMatch(/finisher badge/i)
  })

  it("treats a null rule as the any-minted default", () => {
    const res = evaluateEligibility(null, holder)
    expect(res.eligible).toBe(true)
    expect(DEFAULT_RULE).toEqual({ type: "any-minted" })
  })
})

describe("evaluateEligibility — first-n-mints", () => {
  it("is eligible when within the first N", () => {
    const res = evaluateEligibility(
      { type: "first-n-mints", n: 10 },
      { ...holder, mintRank: 5 }
    )
    expect(res.eligible).toBe(true)
    expect(res.reason).toContain("#5")
  })

  it("is eligible exactly at the boundary (rank === n)", () => {
    const res = evaluateEligibility(
      { type: "first-n-mints", n: 5 },
      { ...holder, mintRank: 5 }
    )
    expect(res.eligible).toBe(true)
  })

  it("is not eligible past the first N", () => {
    const res = evaluateEligibility(
      { type: "first-n-mints", n: 3 },
      { ...holder, mintRank: 5 }
    )
    expect(res.eligible).toBe(false)
    expect(res.reason).toMatch(/past the first 3/i)
  })

  it("is not eligible when there is no recorded mint", () => {
    const res = evaluateEligibility(
      { type: "first-n-mints", n: 100 },
      { ...holder, mintRank: null }
    )
    expect(res.eligible).toBe(false)
    expect(res.reason).toMatch(/no recorded mint/i)
  })
})

describe("evaluateEligibility — min-scans", () => {
  it("is eligible when scan count meets the threshold", () => {
    const res = evaluateEligibility(
      { type: "min-scans", n: 5 },
      { ...holder, scanCount: 7 }
    )
    expect(res.eligible).toBe(true)
    expect(res.reason).toContain("7")
  })

  it("is eligible exactly at the threshold", () => {
    const res = evaluateEligibility(
      { type: "min-scans", n: 7 },
      { ...holder, scanCount: 7 }
    )
    expect(res.eligible).toBe(true)
  })

  it("is not eligible below the threshold", () => {
    const res = evaluateEligibility(
      { type: "min-scans", n: 10 },
      { ...holder, scanCount: 4 }
    )
    expect(res.eligible).toBe(false)
    expect(res.reason).toMatch(/4 of 10/i)
  })
})

describe("normalizeRule", () => {
  it("falls back to the default for null / garbage", () => {
    expect(normalizeRule(null)).toEqual(DEFAULT_RULE)
    expect(normalizeRule(undefined)).toEqual(DEFAULT_RULE)
    expect(normalizeRule("nope")).toEqual(DEFAULT_RULE)
    expect(normalizeRule({ type: "unknown" })).toEqual(DEFAULT_RULE)
  })

  it("coerces a missing numeric n to 0", () => {
    expect(normalizeRule({ type: "first-n-mints" })).toEqual({
      type: "first-n-mints",
      n: 0,
    })
    expect(normalizeRule({ type: "min-scans" })).toEqual({
      type: "min-scans",
      n: 0,
    })
  })

  it("passes through valid rules", () => {
    expect(normalizeRule({ type: "first-n-mints", n: 50 })).toEqual({
      type: "first-n-mints",
      n: 50,
    })
  })
})

describe("describeRule", () => {
  it("renders short labels", () => {
    expect(describeRule(null)).toBe("Any badge holder")
    expect(describeRule({ type: "first-n-mints", n: 100 })).toBe(
      "First 100 mints"
    )
    expect(describeRule({ type: "min-scans", n: 5 })).toBe("≥ 5 scans")
  })
})
