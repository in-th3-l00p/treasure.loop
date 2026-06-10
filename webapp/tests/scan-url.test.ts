import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { scanUrl, signScanToken, verifyScanToken } from "@/lib/scan-url"

// Pin a deterministic secret so signatures are stable across runs.
beforeEach(() => {
  vi.stubEnv("SCAN_URL_SECRET", "test-scan-url-secret")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const CP = "cp_test123"

function currentBucket(): number {
  return Math.floor(Date.now() / 60_000)
}

describe("signScanToken", () => {
  it("produces a 32-char hex token", () => {
    const t = signScanToken(CP)
    expect(t).toMatch(/^[0-9a-f]{32}$/)
  })

  it("is deterministic for the same checkpoint and bucket", () => {
    const b = currentBucket()
    expect(signScanToken(CP, b)).toBe(signScanToken(CP, b))
  })

  it("differs for different checkpoints", () => {
    const b = currentBucket()
    expect(signScanToken("cp_a", b)).not.toBe(signScanToken("cp_b", b))
  })

  it("differs across buckets", () => {
    const b = currentBucket()
    expect(signScanToken(CP, b)).not.toBe(signScanToken(CP, b + 1))
  })
})

describe("verifyScanToken", () => {
  it("accepts a token for the current bucket", () => {
    expect(verifyScanToken(CP, signScanToken(CP))).toBe(true)
  })

  it("accepts a token from the previous bucket (-1 drift)", () => {
    const b = currentBucket()
    expect(verifyScanToken(CP, signScanToken(CP, b - 1))).toBe(true)
  })

  it("accepts a token from the next bucket (+1 drift)", () => {
    const b = currentBucket()
    expect(verifyScanToken(CP, signScanToken(CP, b + 1))).toBe(true)
  })

  it("rejects a token signed for a different checkpoint", () => {
    const token = signScanToken("cp_other")
    expect(verifyScanToken(CP, token)).toBe(false)
  })

  it("rejects a tampered token", () => {
    const token = signScanToken(CP)
    const tampered =
      (token[0] === "0" ? "1" : "0") + token.slice(1)
    expect(verifyScanToken(CP, tampered)).toBe(false)
  })

  it("rejects an expired token (bucket -2, outside drift window)", () => {
    const b = currentBucket()
    expect(verifyScanToken(CP, signScanToken(CP, b - 2))).toBe(false)
  })

  it("rejects empty inputs", () => {
    expect(verifyScanToken(CP, "")).toBe(false)
    expect(verifyScanToken("", signScanToken(CP))).toBe(false)
  })

  it("rejects a token whose secret has changed", () => {
    const token = signScanToken(CP)
    vi.stubEnv("SCAN_URL_SECRET", "a-totally-different-secret")
    expect(verifyScanToken(CP, token)).toBe(false)
  })
})

describe("scanUrl", () => {
  it("builds a relative path with cp and a verifying token", () => {
    const url = scanUrl(CP)
    expect(url.startsWith("/play/scan?")).toBe(true)
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1))
    expect(params.get("cp")).toBe(CP)
    const token = params.get("t")
    expect(token).toBeTruthy()
    expect(verifyScanToken(CP, token as string)).toBe(true)
  })
})
