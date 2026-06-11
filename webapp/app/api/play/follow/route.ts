import { NextResponse } from "next/server"

import { getAddress } from "viem"

import {
  countFollowers,
  countFollowing,
  follow,
  isFollowing,
  unfollow,
  walletForHandle,
} from "@/lib/player-follows"
import { getPlayAddress } from "@/lib/play-session"

/**
 * Player following API — the social graph for the public profile.
 *
 * A target is identified by its public `handle` (or its `wallet`
 * directly). Writes require a signed-in wallet (SIWE play session).
 * Follower counts are public, so GET works for anonymous callers too —
 * they just get `isFollowing: false` and `signedIn: false`.
 */

/** Resolve a request body's `{ handle }` / `{ wallet }` to a checksummed wallet. */
async function resolveTarget(body: {
  handle?: unknown
  wallet?: unknown
}): Promise<string | null> {
  if (typeof body.wallet === "string" && body.wallet.length > 0) {
    try {
      return getAddress(body.wallet)
    } catch {
      return null
    }
  }
  if (typeof body.handle === "string" && body.handle.length > 0) {
    return walletForHandle(body.handle)
  }
  return null
}

/**
 * GET ?handle=… (or ?wallet=…) — the follow state for a target profile.
 * Returns `{ isFollowing, followers, following, signedIn }`. No auth
 * required; `isFollowing` is relative to the signed-in wallet (false when
 * anonymous), and the counts are the target's public totals.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const handle = url.searchParams.get("handle")
  const wallet = url.searchParams.get("wallet")

  const target = await resolveTarget({
    handle: handle ?? undefined,
    wallet: wallet ?? undefined,
  })
  if (!target) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }

  const viewer = await getPlayAddress()
  const [followers, following, followingState] = await Promise.all([
    countFollowers(target),
    countFollowing(target),
    viewer ? isFollowing(viewer, target) : Promise.resolve(false),
  ])

  return NextResponse.json({
    isFollowing: followingState,
    followers,
    following,
    signedIn: viewer !== null,
  })
}

/**
 * POST { handle } (or { wallet }) — follow the target as the signed-in
 * wallet. 401 if not signed in, 400 on a self-follow, 404 if the target
 * is unknown. Returns `{ ok, isFollowing: true, followers }`.
 */
export async function POST(req: Request) {
  const viewer = await getPlayAddress()
  if (!viewer) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
  }

  let body: { handle?: unknown; wallet?: unknown }
  try {
    body = (await req.json()) as { handle?: unknown; wallet?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  const target = await resolveTarget(body)
  if (!target) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }
  if (target === viewer) {
    return NextResponse.json({ error: "self-follow" }, { status: 400 })
  }

  await follow(viewer, target)
  const followers = await countFollowers(target)

  return NextResponse.json({ ok: true, isFollowing: true, followers })
}

/**
 * DELETE { handle } (or { wallet }) — unfollow the target. 401 if not
 * signed in, 404 if the target is unknown. Returns
 * `{ ok, isFollowing: false, followers }`.
 */
export async function DELETE(req: Request) {
  const viewer = await getPlayAddress()
  if (!viewer) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 })
  }

  let body: { handle?: unknown; wallet?: unknown }
  try {
    body = (await req.json()) as { handle?: unknown; wallet?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  const target = await resolveTarget(body)
  if (!target) {
    return NextResponse.json({ error: "not-found" }, { status: 404 })
  }

  await unfollow(viewer, target)
  const followers = await countFollowers(target)

  return NextResponse.json({ ok: true, isFollowing: false, followers })
}
