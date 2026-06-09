import { NextResponse } from "next/server"

import { getPlayAddress } from "@/lib/play-session"
import {
  isValidCheckpoint,
  playerStore,
  toPublicProgress,
} from "@/lib/player-store"

interface ScanBody {
  checkpointId?: string
  /**
   * Optional per-checkpoint verification code. In the real product the
   * server checks this against a rotating booth-staff secret; here we
   * accept any non-empty value so the demo flow works end to end.
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

  if (!body.checkpointId || !isValidCheckpoint(body.checkpointId)) {
    return NextResponse.json(
      { error: "unknown-checkpoint" },
      { status: 400 }
    )
  }

  if (!body.code || body.code.trim().length === 0) {
    return NextResponse.json(
      { error: "missing-code" },
      { status: 400 }
    )
  }

  const updated = playerStore.scan(address, body.checkpointId)
  if (!updated) {
    return NextResponse.json(
      { error: "scan-rejected" },
      { status: 400 }
    )
  }

  return NextResponse.json({ progress: toPublicProgress(updated) })
}
