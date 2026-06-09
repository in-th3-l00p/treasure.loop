import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { db } from "@/db/client"
import { checkpoints } from "@/db/schema"
import { verifyCheckpointCode } from "@/lib/checkpoint-codes"
import { getPlayAddress } from "@/lib/play-session"
import {
  currentEventId,
  isValidCheckpoint,
  recordScan,
} from "@/lib/player-store"

interface ScanBody {
  checkpointId?: string
  /**
   * Per-checkpoint rotating TOTP code (6 digits). Booth staff sees the
   * current code on `/app/booth/[checkpointId]`; the player types it.
   * The server verifies against the checkpoint's stored secret with a
   * ±1 window drift tolerance.
   */
  code?: string
}

export async function POST(req: Request) {
  const address = await getPlayAddress()
  if (!address) {
    return NextResponse.json(
      { error: "not-authenticated" },
      { status: 401 }
    )
  }

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
  if (!body.code || body.code.trim().length === 0) {
    return NextResponse.json({ error: "missing-code" }, { status: 400 })
  }

  const eventId = await currentEventId()

  if (!(await isValidCheckpoint(eventId, body.checkpointId))) {
    return NextResponse.json(
      { error: "unknown-checkpoint" },
      { status: 400 }
    )
  }

  // Pull the checkpoint's TOTP secret and verify the code.
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
      return NextResponse.json(
        { error: "checkpoint-not-configured" },
        { status: 503 }
      )
    }
  } else if (!verifyCheckpointCode(cp.secret, body.code)) {
    return NextResponse.json({ error: "invalid-code" }, { status: 401 })
  }

  const progress = await recordScan({
    eventId,
    wallet: address,
    checkpointId: body.checkpointId,
  })
  if (!progress) {
    return NextResponse.json({ error: "scan-rejected" }, { status: 400 })
  }

  return NextResponse.json({ progress })
}
