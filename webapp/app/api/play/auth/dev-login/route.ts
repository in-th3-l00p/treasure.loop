import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"
import { type Address, getAddress, isAddress } from "viem"

import { MOCK_CHAIN } from "@/lib/badge-contract"
import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { getPlaySession } from "@/lib/play-session"

/**
 * DEV-ONLY test-wallet login (PoC). When MOCK_CHAIN is on (and we're not
 * in production), this seals a play session for a generated — or
 * caller-supplied — wallet address WITHOUT a SIWE signature, so the whole
 * attendee loop (scan → pair → mint → prize) can be demoed and tested
 * without a browser wallet. Hard-refuses when MOCK_CHAIN is off.
 */
export const POST = withRouteLogging(
  "play/auth/dev-login",
  async (req: Request, ctx: RouteContext) => {
    if (!MOCK_CHAIN) {
      return NextResponse.json({ error: "not-available" }, { status: 404 })
    }

    let body: { address?: string } = {}
    try {
      body = (await req.json()) as { address?: string }
    } catch {
      // empty body is fine — we generate an address
    }

    let address: Address
    if (typeof body.address === "string" && isAddress(body.address)) {
      address = getAddress(body.address)
    } else {
      address = getAddress(`0x${randomBytes(20).toString("hex")}`)
    }

    const session = await getPlaySession()
    session.address = address
    session.chainId = 84532 // Base Sepolia
    session.issuedAt = Date.now()
    delete session.pendingNonce
    await session.save()
    ctx.set({ actor: address })

    return NextResponse.json({ ok: true, address })
  }
)
