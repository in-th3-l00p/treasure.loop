import { NextResponse } from "next/server"

import { getPlayAddress } from "@/lib/play-session"
import {
  currentEventId,
  isValidCheckpoint,
  recordScan,
} from "@/lib/player-store"

interface ScanBody {
  checkpointId?: string
  /**
   * Per-checkpoint verification code. Phase 3 verifies this against a
   * rotating TOTP secret stored on the checkpoint row; today we just
   * require it to be non-empty so the demo flow works end-to-end.
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
