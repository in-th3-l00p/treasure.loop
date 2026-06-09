import { NextResponse } from "next/server"

import { getPlaySession } from "@/lib/play-session"

/**
 * Returns the SIWE-authenticated wallet for the current session, or
 * `{ address: null }` if there is none. Used by the client to decide
 * whether to skip the SIWE prompt.
 */
export async function GET() {
  const session = await getPlaySession()
  return NextResponse.json({
    address: session.address ?? null,
    chainId: session.chainId ?? null,
    issuedAt: session.issuedAt ?? null,
  })
}
