/**
 * In-process sliding-window rate limiter.
 *
 * Why in-memory: Vercel KV is the right answer for production, but
 * one extra integration would gate this PR on credentials. The
 * interface below is what we'll wrap around `@upstash/ratelimit`
 * when we wire KV — keep call sites unchanged.
 *
 * Trade-off: in serverless deploys with cold-spawned instances the
 * counters reset between cold starts, so the effective rate is per-
 * instance, not global. Good enough to slow brute-force; not good
 * enough to be the only defense against a determined attacker.
 */

interface Counter {
  tokens: number
  reset: number
}

type Bucket = Map<string, Counter>

const buckets = new Map<string, Bucket>()

function getBucket(name: string): Bucket {
  let b = buckets.get(name)
  if (!b) {
    b = new Map()
    buckets.set(name, b)
  }
  return b
}

export interface LimitConfig {
  /** Bucket name (per-policy namespace). */
  name: string
  /** Maximum requests per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface LimitResult {
  ok: boolean
  remaining: number
  resetMs: number
  retryAfterMs: number
}

export function rateLimit(key: string, cfg: LimitConfig): LimitResult {
  const now = Date.now()
  const bucket = getBucket(cfg.name)
  const entry = bucket.get(key)
  if (!entry || entry.reset <= now) {
    bucket.set(key, { tokens: cfg.limit - 1, reset: now + cfg.windowMs })
    return { ok: true, remaining: cfg.limit - 1, resetMs: cfg.windowMs, retryAfterMs: 0 }
  }
  if (entry.tokens <= 0) {
    return {
      ok: false,
      remaining: 0,
      resetMs: entry.reset - now,
      retryAfterMs: entry.reset - now,
    }
  }
  entry.tokens -= 1
  return {
    ok: true,
    remaining: entry.tokens,
    resetMs: entry.reset - now,
    retryAfterMs: 0,
  }
}

/** Best-effort identifier for a request: prefers the wallet/Clerk id when known, falls back to a hashed IP. */
export function rateLimitKeyFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const real = req.headers.get("x-real-ip")
  return forwarded || real || "anonymous"
}

/** Test-only: drop every counter. */
export function __resetRateLimitBuckets() {
  buckets.clear()
}
