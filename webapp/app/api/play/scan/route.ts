import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/client"
import { auditLog, checkpoints } from "@/db/schema"
import { verifyCheckpointCode } from "@/lib/checkpoint-codes"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { increment, Metric } from "@/lib/metrics"
import { getPlayAddress } from "@/lib/play-session"
import {
  currentEventId,
  isCheckpointOffline,
  isValidCheckpoint,
  recordScan,
} from "@/lib/player-store"
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit"
import { verifyScanToken } from "@/lib/scan-url"

interface ScanBody {
  checkpointId?: string
  /**
   * Per-checkpoint rotating TOTP code (6 digits). Booth staff sees the
   * current code on `/app/booth/[checkpointId]`; the player types it.
   * The server verifies against the checkpoint's stored secret with a
   * ±1 window drift tolerance.
   */
  code?: string
  /**
   * Optional HMAC-signed URL token from a tap-to-scan flow
   * (`/play/scan?cp=…&t=…`). When present it MUST verify; when absent we
   * fall through to the TOTP `code` path so manual entry still works.
   */
  t?: string
}

type RejectReason =
  | "bad-url-token"
  | "unknown-checkpoint"
  | "checkpoint-offline"
  | "invalid-code"
  | "checkpoint-not-configured"
  | "scan-rejected"

/**
 * Best-effort audit row for a rejected scan. Wrapped so an audit-write
 * failure never blocks the player's response. We intentionally do NOT
 * log the rate-limited (429) path to avoid flooding the table.
 */
async function auditReject(opts: {
  reason: RejectReason
  actor: string
  eventId: string | null
  checkpointId: string | null
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      eventId: opts.eventId,
      actor: opts.actor,
      action: "player.scan_rejected",
      target: opts.checkpointId,
      meta: { reason: opts.reason },
    })
  } catch {
    // Audit is best-effort; swallow so the response is never blocked.
  }
}

export const POST = withRouteLogging(
  "play/scan",
  async (req: Request, ctx: RouteContext) => {
  // Per-IP rate limit: 30 scans/minute is more than a real player can
  // physically do across a venue. Catches brute-forcing the TOTP.
  const limit = rateLimit(rateLimitKeyFromRequest(req), {
    name: "play-scan",
    limit: 30,
    windowMs: 60_000,
  })
  if (!limit.ok) {
    increment(Metric.Scan, { outcome: "rate_limited" })
    return NextResponse.json(
      { error: "rate-limited", retryAfterMs: limit.retryAfterMs },
      {
        status: 429,
        headers: {
          "retry-after": Math.ceil(limit.retryAfterMs / 1000).toString(),
        },
      }
    )
  }

  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }
  ctx.set({ actor: address })

  let body: ScanBody
  try {
    body = (await req.json()) as ScanBody
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.checkpointId) {
    return NextResponse.json(
      { error: "missing-checkpoint" },
      { status: 400 }
    )
  }

  // A tap-to-scan URL carries a signed token (`t`). When present it must
  // verify for this checkpoint; otherwise we require a manual TOTP code.
  const hasToken = typeof body.t === "string" && body.t.length > 0
  if (!hasToken && (!body.code || body.code.trim().length === 0)) {
    return NextResponse.json({ error: "missing-code" }, { status: 400 })
  }

  const eventId = await currentEventId()

  ctx.set({ checkpointId: body.checkpointId })

  if (!(await isValidCheckpoint(eventId, body.checkpointId))) {
    increment(Metric.Scan, { outcome: "rejected", reason: "unknown-checkpoint" })
    await auditReject({
      reason: "unknown-checkpoint",
      actor: address,
      eventId,
      checkpointId: body.checkpointId,
    })
    return NextResponse.json(
      { error: "unknown-checkpoint" },
      { status: 400 }
    )
  }

  // A paused booth (status = 'offline') refuses scans regardless of a
  // valid code or token. Booth staff toggle this from the kiosk when they
  // step away or hit a queue they need to drain first.
  if (await isCheckpointOffline(eventId, body.checkpointId)) {
    increment(Metric.Scan, { outcome: "rejected", reason: "checkpoint-offline" })
    await auditReject({
      reason: "checkpoint-offline",
      actor: address,
      eventId,
      checkpointId: body.checkpointId,
    })
    return NextResponse.json({ error: "checkpoint-offline" }, { status: 409 })
  }

  if (hasToken) {
    // Signed-URL path: the token proves a recent tap of this checkpoint's
    // NFC tag. Reject if it doesn't verify; never silently fall back to
    // the TOTP code (a bad token is a tamper signal, not a typo).
    if (!verifyScanToken(body.checkpointId, body.t as string)) {
      increment(Metric.Scan, { outcome: "rejected", reason: "bad-url-token" })
      await auditReject({
        reason: "bad-url-token",
        actor: address,
        eventId,
        checkpointId: body.checkpointId,
      })
      return NextResponse.json({ error: "bad-url-token" }, { status: 401 })
    }
  } else {
    // Manual-entry path: pull the checkpoint's TOTP secret and verify.
    const [cp] = await db
      .select({ secret: checkpoints.totpSecret })
      .from(checkpoints)
      .where(
        and(
          eq(checkpoints.id, body.checkpointId),
          eq(checkpoints.eventId, eventId)
        )
      )
      .limit(1)

    if (!cp?.secret) {
      // Checkpoint hasn't been configured with a TOTP secret yet.
      // Soft-fail so a half-configured event doesn't silently accept
      // every code in production. (Tests / older seeds bypass this by
      // setting `ALLOW_UNSECURED_SCANS=1` in env.)
      if (process.env.ALLOW_UNSECURED_SCANS !== "1") {
        increment(Metric.Scan, {
          outcome: "rejected",
          reason: "checkpoint-not-configured",
        })
        await auditReject({
          reason: "checkpoint-not-configured",
          actor: address,
          eventId,
          checkpointId: body.checkpointId,
        })
        return NextResponse.json(
          { error: "checkpoint-not-configured" },
          { status: 503 }
        )
      }
    } else if (!verifyCheckpointCode(cp.secret, body.code as string)) {
      increment(Metric.Scan, { outcome: "rejected", reason: "invalid-code" })
      await auditReject({
        reason: "invalid-code",
        actor: address,
        eventId,
        checkpointId: body.checkpointId,
      })
      return NextResponse.json({ error: "invalid-code" }, { status: 401 })
    }
  }

  const progress = await recordScan({
    eventId,
    wallet: address,
    checkpointId: body.checkpointId,
  })
  if (!progress) {
    increment(Metric.Scan, { outcome: "rejected", reason: "scan-rejected" })
    await auditReject({
      reason: "scan-rejected",
      actor: address,
      eventId,
      checkpointId: body.checkpointId,
    })
    return NextResponse.json({ error: "scan-rejected" }, { status: 400 })
  }

  increment(Metric.Scan, { outcome: "ok" })
  return NextResponse.json({ progress })
  }
)
