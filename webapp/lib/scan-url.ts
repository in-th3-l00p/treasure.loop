import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * HMAC-signed scan URLs.
 *
 * The booth's NFC tag opens `/play/scan?cp=<checkpointId>&t=<token>`.
 * The token proves the URL was generated recently for that specific
 * checkpoint, so an attacker who sniffs the link gets only ~60s of
 * usefulness before it rotates out.
 *
 * Design
 * ──────
 *   - HMAC-SHA256 over `${checkpointId}.${timeBucket}` keyed by
 *     `SCAN_URL_SECRET`. The time bucket is `floor(Date.now()/60000)`,
 *     so a token is valid for its minute plus ±1 minute of clock drift.
 *   - We truncate the hex digest to keep the URL short; 32 hex chars
 *     (128 bits) is far more than enough to make forgery infeasible.
 *   - Verification is constant-time (`timingSafeEqual`) and tries the
 *     current bucket and ±1 to absorb skew between the tag-printing
 *     device and the server.
 *
 * This complements — does not replace — the per-checkpoint TOTP code:
 * manual code entry still works when there's no token (see the scan
 * route's fall-through). A signed URL just lets a tap-to-scan flow skip
 * the manual code.
 */

const TOKEN_HEX_LEN = 32 // 16 bytes / 128 bits, truncated from the digest.

let warnedMissingSecret = false

/**
 * Resolve the signing secret. Mirrors the pragmatic env handling used by
 * `play-session.ts` / `rate-limit.ts`: in dev/test we fall back to a
 * fixed secret (warning once) so the app boots without configuration.
 * PRODUCTION MUST set `SCAN_URL_SECRET` — otherwise signed scan URLs are
 * trivially forgeable.
 */
function scanSecret(): string {
  const secret = process.env.SCAN_URL_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SCAN_URL_SECRET must be set in production to sign scan URLs."
    )
  }

  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    console.warn(
      "[scan-url] SCAN_URL_SECRET is not set; using a dev-only fallback. " +
        "NEVER ship to production without setting SCAN_URL_SECRET."
    )
  }
  return "dev-only-fallback-scan-url-secret-change-me!!"
}

/** The current time bucket: one bucket per minute. */
function currentBucket(): number {
  return Math.floor(Date.now() / 60_000)
}

/**
 * Sign a scan token for a checkpoint. Defaults to the current bucket;
 * pass an explicit `bucket` only for testing drift / expiry.
 */
export function signScanToken(checkpointId: string, bucket?: number): string {
  const b = bucket ?? currentBucket()
  return createHmac("sha256", scanSecret())
    .update(`${checkpointId}.${b}`)
    .digest("hex")
    .slice(0, TOKEN_HEX_LEN)
}

/** Constant-time string compare that never throws on length mismatch. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * Verify a scan token for a checkpoint. Accepts the current bucket and
 * ±1 (drift tolerance). Constant-time comparison against each candidate.
 */
export function verifyScanToken(checkpointId: string, token: string): boolean {
  if (!checkpointId || !token) return false
  const now = currentBucket()
  for (const b of [now, now - 1, now + 1]) {
    if (constantTimeEqual(token, signScanToken(checkpointId, b))) {
      return true
    }
  }
  return false
}

/** Build the relative scan path with a fresh token for a checkpoint. */
export function scanUrl(checkpointId: string): string {
  const params = new URLSearchParams({
    cp: checkpointId,
    t: signScanToken(checkpointId),
  })
  return `/play/scan?${params.toString()}`
}
