import { NextResponse } from "next/server"

import { getPlaySession } from "@/lib/play-session"

export async function POST() {
  const session = await getPlaySession()
  session.destroy()
  return NextResponse.json({ ok: true })
}
