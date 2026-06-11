import { NextResponse } from "next/server"

import { withRouteLogging, type RouteContext } from "@/lib/logger"
import { getPlayAddress } from "@/lib/play-session"
import {
  getProfileByWallet,
  HandleTakenError,
  InvalidHandleError,
  upsertProfile,
  type ProfileInput,
} from "@/lib/player-profiles"

/**
 * The signed-in wallet's own profile.
 *
 * GET  → `{ profile }` (profile may be null if never set up).
 * PUT  → save `{ handle, displayName, bio, avatarUrl }`; returns the row.
 *        409 `{ error: "handle-taken" }` on conflict, 400 on invalid handle.
 *
 * Both require an authenticated play session (SIWE), 401 otherwise.
 */

export const GET = withRouteLogging(
  "play/profile",
  async (_req: Request, ctx: RouteContext) => {
    const address = await getPlayAddress()
    if (!address) {
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })

    const profile = await getProfileByWallet(address)
    return NextResponse.json({ profile })
  }
)

export const PUT = withRouteLogging(
  "play/profile",
  async (req: Request, ctx: RouteContext) => {
    const address = await getPlayAddress()
    if (!address) {
      return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
    }
    ctx.set({ actor: address })

    let body: ProfileInput
    try {
      body = (await req.json()) as ProfileInput
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 })
    }

    try {
      const profile = await upsertProfile(address, {
        handle: body.handle,
        displayName: body.displayName,
        bio: body.bio,
        avatarUrl: body.avatarUrl,
      })
      return NextResponse.json({ profile })
    } catch (err) {
      if (err instanceof HandleTakenError) {
        return NextResponse.json({ error: "handle-taken" }, { status: 409 })
      }
      if (err instanceof InvalidHandleError) {
        return NextResponse.json({ error: "invalid-handle" }, { status: 400 })
      }
      throw err
    }
  }
)
