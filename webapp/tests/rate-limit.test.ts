import { afterEach, describe, expect, it, vi } from "vitest"

import {
  __resetRateLimitBuckets,
  rateLimit,
  rateLimitKeyFromRequest,
} from "@/lib/rate-limit"

afterEach(() => {
  __resetRateLimitBuckets()
  vi.useRealTimers()
})

describe("rateLimit", () => {
  it("allows up to `limit` requests then rejects further ones", () => {
    const cfg = { name: "t1", limit: 3, windowMs: 1_000 }
    expect(rateLimit("k", cfg).ok).toBe(true)
    expect(rateLimit("k", cfg).ok).toBe(true)
    expect(rateLimit("k", cfg).ok).toBe(true)
    const fourth = rateLimit("k", cfg)
    expect(fourth.ok).toBe(false)
    expect(fourth.remaining).toBe(0)
    expect(fourth.retryAfterMs).toBeGreaterThan(0)
  })

  it("scopes per key — different callers don't share counters", () => {
    const cfg = { name: "t2", limit: 1, windowMs: 1_000 }
    expect(rateLimit("alice", cfg).ok).toBe(true)
    expect(rateLimit("bob", cfg).ok).toBe(true)
    expect(rateLimit("alice", cfg).ok).toBe(false)
    expect(rateLimit("bob", cfg).ok).toBe(false)
  })

  it("scopes per name — different policies are independent", () => {
    expect(rateLimit("k", { name: "policyA", limit: 1, windowMs: 1_000 }).ok).toBe(true)
    expect(rateLimit("k", { name: "policyA", limit: 1, windowMs: 1_000 }).ok).toBe(false)
    expect(rateLimit("k", { name: "policyB", limit: 1, windowMs: 1_000 }).ok).toBe(true)
  })

  it("the window resets after the configured time", () => {
    vi.useFakeTimers()
    const cfg = { name: "t3", limit: 1, windowMs: 100 }
    expect(rateLimit("k", cfg).ok).toBe(true)
    expect(rateLimit("k", cfg).ok).toBe(false)
    vi.advanceTimersByTime(101)
    expect(rateLimit("k", cfg).ok).toBe(true)
  })

  it("decrements `remaining` deterministically", () => {
    const cfg = { name: "t4", limit: 4, windowMs: 1_000 }
    expect(rateLimit("k", cfg).remaining).toBe(3)
    expect(rateLimit("k", cfg).remaining).toBe(2)
    expect(rateLimit("k", cfg).remaining).toBe(1)
    expect(rateLimit("k", cfg).remaining).toBe(0)
    expect(rateLimit("k", cfg).ok).toBe(false)
  })
})

describe("rateLimitKeyFromRequest", () => {
  it("prefers x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    })
    expect(rateLimitKeyFromRequest(req)).toBe("1.2.3.4")
  })
  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.9.9.9" },
    })
    expect(rateLimitKeyFromRequest(req)).toBe("9.9.9.9")
  })
  it("returns 'anonymous' if neither header is set", () => {
    const req = new Request("http://localhost")
    expect(rateLimitKeyFromRequest(req)).toBe("anonymous")
  })
})
