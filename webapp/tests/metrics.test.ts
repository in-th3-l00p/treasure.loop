import { afterEach, describe, expect, it } from "vitest"

import {
  __resetMetrics,
  getCounter,
  increment,
  Metric,
  snapshot,
} from "@/lib/metrics"

afterEach(() => {
  __resetMetrics()
})

describe("metrics counters", () => {
  it("starts at zero and increments by one by default", () => {
    expect(getCounter("play.scan")).toBe(0)
    increment("play.scan")
    increment("play.scan")
    expect(getCounter("play.scan")).toBe(2)
  })

  it("supports a custom increment amount", () => {
    increment("play.scan", undefined, 5)
    expect(getCounter("play.scan")).toBe(5)
  })

  it("keeps label permutations as distinct series", () => {
    increment(Metric.Scan, { outcome: "ok" })
    increment(Metric.Scan, { outcome: "ok" })
    increment(Metric.Scan, { outcome: "rejected", reason: "invalid-code" })

    expect(getCounter(Metric.Scan, { outcome: "ok" })).toBe(2)
    expect(
      getCounter(Metric.Scan, { outcome: "rejected", reason: "invalid-code" })
    ).toBe(1)
    // Unlabeled series is independent of any labeled one.
    expect(getCounter(Metric.Scan)).toBe(0)
  })

  it("treats label order as insignificant (canonical key)", () => {
    increment("play.mint", { outcome: "ok", stage: "confirm" })
    // Same labels, different declaration order — must hit the same series.
    expect(getCounter("play.mint", { stage: "confirm", outcome: "ok" })).toBe(1)
  })

  it("coerces non-string label values consistently", () => {
    increment("play.scan", { ok: true, count: 3 })
    expect(getCounter("play.scan", { ok: true, count: 3 })).toBe(1)
    expect(getCounter("play.scan", { ok: "true", count: "3" })).toBe(1)
  })

  it("snapshot returns a JSON-serializable view of every series", () => {
    increment(Metric.Scan, { outcome: "ok" })
    increment(Metric.Mint, { outcome: "confirmed" })

    const snap = snapshot()
    expect(snap["play.scan{outcome=ok}"]).toBe(1)
    expect(snap["play.mint{outcome=confirmed}"]).toBe(1)
    // Round-trips through JSON unchanged.
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
  })

  it("__resetMetrics clears all counters", () => {
    increment("play.scan")
    __resetMetrics()
    expect(getCounter("play.scan")).toBe(0)
    expect(snapshot()).toEqual({})
  })
})
