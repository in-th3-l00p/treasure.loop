import { NextResponse } from "next/server"

import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { getPlayAddress } from "@/lib/play-session"
import {
  combineFragments,
  currentEventId,
  getPlayerActiveFragment,
  reportPairCheating,
} from "@/lib/player-store"
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit"

/**
 * Pair-fragment endpoint (ROADMAP Phase 7).
 *
 * GET  → the caller's current fragment (or null), for the /play/pair screen.
 * POST → `{ action: "combine", code }` combines the caller's fragment with
 *        the one named by `code`, granting the checkpoint to both wallets;
 *        `{ action: "report", code?, note? }` flags a suspected cheating
 *        pair for human review at the prize desk.
 */

interface PairBody {
  action?: "combine" | "report"
  code?: string
  note?: string
}

export const GET = withRouteLogging(
  "play/pair",
  async (_req: Request, ctx: RouteContext) => {
    const address = await getPlayAddress()
    if (!address) {
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })
    const eventId = await currentEventId()
    const fragment = await getPlayerActiveFragment(eventId, address)
    return NextResponse.json({ fragment })
  }
)

export const POST = withRouteLogging(
  "play/pair",
  async (req: Request, ctx: RouteContext) => {
    // Rate-limit the combine endpoint: the entered code is a 5-char
    // short code scoped to one checkpoint, so an unbounded POST loop
    // could brute-force another player's code. 30/min per IP.
    const limit = rateLimit(rateLimitKeyFromRequest(req), {
      name: "play-pair",
      limit: 30,
      windowMs: 60_000,
    })
    if (!limit.ok) {
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
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })

    let body: PairBody
    try {
      body = (await req.json()) as PairBody
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 })
    }

    const eventId = await currentEventId()

    if (body.action === "report") {
      await reportPairCheating({
        eventId,
        wallet: address,
        enteredCode: body.code,
        note: body.note,
      })
      return NextResponse.json({ ok: true })
    }

    const code = typeof body.code === "string" ? body.code.trim() : ""
    if (!code) {
      return NextResponse.json({ error: "missing-code" }, { status: 400 })
    }

    const result = await combineFragments({
      eventId,
      wallet: address,
      enteredCode: code,
    })
    if (!result.ok) {
      // `no-fragment` is a client state error (nothing to combine); the
      // rest are conflicts against another fragment's state.
      const status = result.reason === "no-fragment" ? 400 : 409
      return NextResponse.json({ error: result.reason }, { status })
    }
    return NextResponse.json(result)
  }
)
