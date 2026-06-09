import { NextResponse } from "next/server"
import { SiweMessage } from "siwe"
import { getAddress } from "viem"

import { getPlaySession } from "@/lib/play-session"

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
export async function POST(req: Request) {
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

  return NextResponse.json({ ok: true, address: session.address })
}
