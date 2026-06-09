import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"

import { db } from "@/db/client"
import {
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
} from "@/lib/badge-contract"

/**
 * Cheap, public health probe. Used by uptime monitors + the preflight
 * page. We deliberately don't lock this behind auth so an external
 * checker can curl it.
 *
 * Returns 200 if the database is reachable; 503 otherwise. The body
 * is informational only.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // Database
  const t0 = Date.now()
  try {
    await db.execute(sql`select 1`)
    checks.database = { ok: true, detail: `${Date.now() - t0}ms` }
  } catch (e) {
    checks.database = {
      ok: false,
      detail: e instanceof Error ? e.message : "unknown",
    }
  }

  // Badge contract config
  checks.badge_contract = {
    ok: BADGE_CONTRACT_CONFIGURED,
    detail: BADGE_CONTRACT_CONFIGURED
      ? `${BADGE_CONTRACT_ADDRESS} on chain ${BADGE_CHAIN.id}`
      : "NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS unset",
  }

  // Signer key — never log the key itself, just whether it's present.
  checks.badge_signer = {
    ok: !!process.env.BADGE_SIGNER_PRIVATE_KEY,
    detail: process.env.BADGE_SIGNER_PRIVATE_KEY
      ? "configured"
      : "BADGE_SIGNER_PRIVATE_KEY unset",
  }

  // Play session secret — production must override the dev fallback.
  checks.play_session_secret = {
    ok:
      process.env.NODE_ENV !== "production" ||
      !!process.env.PLAY_SESSION_SECRET,
    detail: process.env.PLAY_SESSION_SECRET
      ? "configured"
      : process.env.NODE_ENV === "production"
        ? "missing"
        : "dev-fallback",
  }

  const overall = checks.database.ok
  return NextResponse.json(
    {
      ok: overall,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: overall ? 200 : 503 }
  )
}
