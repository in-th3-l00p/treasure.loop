import { NextResponse } from "next/server"
import { SiweMessage } from "siwe"
import { getAddress } from "viem"

import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { getPlaySession } from "@/lib/play-session"
import { rateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit"

interface VerifyBody {
  message: string
  signature: string
}

/**
 * Verify a SIWE message + signature.
 *
 * Flow:
 *   1. Client GETs /api/play/auth/nonce → stored on session.
 *   2. Client signs an EIP-4361 message containing that nonce.
 *   3. Client POSTs message + signature here.
 *   4. We replay the message into siwe.verify(), checking the nonce
 *      matches, the signature is valid, and the issued timestamp is
 *      fresh.
 *   5. On success: clear pendingNonce, store address + chainId on the
 *      session, return 200. On failure: 401 with a reason.
 */
export const POST = withRouteLogging(
  "play/auth/verify",
  async (req: Request, ctx: RouteContext) => {
  // Rate limit: 10 verify attempts per IP per minute is way above any
  // legitimate usage, but still cuts brute-force throughput hard.
  const limit = rateLimit(rateLimitKeyFromRequest(req), {
    name: "siwe-verify",
    limit: 10,
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

  const session = await getPlaySession()

  let body: VerifyBody
  try {
    body = (await req.json()) as VerifyBody
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }
  if (!body?.message || !body?.signature) {
    return NextResponse.json(
      { error: "missing-message-or-signature" },
      { status: 400 }
    )
  }

  const expectedNonce = session.pendingNonce
  if (!expectedNonce) {
    return NextResponse.json(
      { error: "no-pending-nonce" },
      { status: 400 }
    )
  }

  let parsed: SiweMessage
  try {
    parsed = new SiweMessage(body.message)
  } catch {
    return NextResponse.json(
      { error: "invalid-siwe-message" },
      { status: 400 }
    )
  }

  try {
    const result = await parsed.verify({
      signature: body.signature,
      nonce: expectedNonce,
    })
    if (!result.success) {
      return NextResponse.json(
        { error: "verification-failed" },
        { status: 401 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "verification-failed" },
      { status: 401 }
    )
  }

  // Auth success — persist on the session.
  session.address = getAddress(parsed.address)
  session.chainId = parsed.chainId
  session.issuedAt = Date.now()
  delete session.pendingNonce
  await session.save()
  ctx.set({ actor: session.address })

  return NextResponse.json({ ok: true, address: session.address })
  }
)
