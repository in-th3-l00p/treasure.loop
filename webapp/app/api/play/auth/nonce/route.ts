import { NextResponse } from "next/server"
import { generateNonce } from "siwe"

import { getPlaySession } from "@/lib/play-session"

/**
 * Issue a per-session nonce for SIWE.
 *
 * The nonce is stored on the encrypted session cookie so the verify
 * step can confirm the signed message matches what we issued. A fresh
 * nonce supersedes any previous unverified one — there's at most one
 * pending nonce per session.
 */
export async function GET() {
  const session = await getPlaySession()
  const nonce = generateNonce()
  session.pendingNonce = nonce
  await session.save()
  return NextResponse.json({ nonce })
}
