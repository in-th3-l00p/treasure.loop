import "server-only"

import { and, desc, eq, ne } from "drizzle-orm"
import { type Address, getAddress } from "viem"

import { db } from "@/db/client"
import {
  badgeMints,
  events,
  players,
  playerProfiles,
  type PlayerProfile,
} from "@/db/schema"
import { isValidHandle, normalizeHandle } from "@/lib/handle"

export { isValidHandle, normalizeHandle }

/**
 * Wallet-keyed player profiles — the social identity layer.
 *
 * A profile is global (not scoped to an event), keyed by the checksummed
 * wallet address that proved ownership via SIWE. Everything on it is
 * optional; a wallet can play without ever filling one in, and the row is
 * created lazily the first time a wallet saves a profile.
 *
 * The public surface is `/u/[handle]`; the owner edits at `/profile`.
 */

export type { PlayerProfile }

/** A finisher badge the wallet earned, for the public "collection" grid. */
export interface ProfileBadge {
  eventName: string
  eventSlug: string
  mintedAt: number
  tokenId: number | null
}

// Handle rules (`isValidHandle` / `normalizeHandle`) live in
// `@/lib/handle` so the client editor can share the exact validation
// without pulling in this server-only module.

/** Thrown by `upsertProfile` when a handle is already taken by another wallet. */
export class HandleTakenError extends Error {
  constructor() {
    super("handle-taken")
    this.name = "HandleTakenError"
  }
}

/** Thrown by `upsertProfile` when a handle fails validation. */
export class InvalidHandleError extends Error {
  constructor() {
    super("invalid-handle")
    this.name = "InvalidHandleError"
  }
}

/** Whether a thrown DB error is a Postgres unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  )
}

// ───────────────────────────── reads ───────────────────────────────

/** The profile for a wallet, or null if none exists. Create-on-read NOT done. */
export async function getProfileByWallet(
  wallet: string
): Promise<PlayerProfile | null> {
  let checksum: Address
  try {
    checksum = getAddress(wallet)
  } catch {
    return null
  }
  const [row] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.wallet, checksum))
    .limit(1)
  return row ?? null
}

/** The profile owning a handle, or null. Handle is matched normalized. */
export async function getProfileByHandle(
  handle: string
): Promise<PlayerProfile | null> {
  const normalized = normalizeHandle(handle)
  if (!normalized) return null
  const [row] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.handle, normalized))
    .limit(1)
  return row ?? null
}

/**
 * A wallet's earned finisher badges — one per event the wallet completed
 * and minted. Joined `badge_mints` → `players` → `events`, newest first.
 */
export async function getProfileCollection(
  wallet: string
): Promise<ProfileBadge[]> {
  let checksum: Address
  try {
    checksum = getAddress(wallet)
  } catch {
    return []
  }
  const rows = await db
    .select({
      eventName: events.name,
      eventSlug: events.slug,
      mintedAt: badgeMints.mintedAt,
      tokenId: badgeMints.tokenId,
    })
    .from(badgeMints)
    .innerJoin(players, eq(badgeMints.playerId, players.id))
    .innerJoin(events, eq(players.eventId, events.id))
    .where(eq(players.wallet, checksum))
    .orderBy(desc(badgeMints.mintedAt))
  return rows.map((r) => ({
    eventName: r.eventName,
    eventSlug: r.eventSlug,
    mintedAt: r.mintedAt.getTime(),
    tokenId: r.tokenId,
  }))
}

// ───────────────────────────── write ───────────────────────────────

export interface ProfileInput {
  handle?: string | null
  displayName?: string | null
  bio?: string | null
  avatarUrl?: string | null
}

/**
 * Create or update the profile for a wallet.
 *
 * - The handle (when provided non-empty) is validated and normalized;
 *   uniqueness is enforced against every other wallet. A collision throws
 *   `HandleTakenError`; an invalid shape throws `InvalidHandleError`.
 * - Passing `undefined` for a field leaves it untouched on update; passing
 *   `null` (or "") clears it.
 * - `updatedAt` is always bumped.
 */
export async function upsertProfile(
  wallet: string,
  input: ProfileInput
): Promise<PlayerProfile> {
  const checksum = getAddress(wallet)

  // Normalize/validate the handle up front. `undefined` => leave as-is.
  let handle: string | null | undefined = undefined
  if (input.handle !== undefined) {
    const trimmed = input.handle === null ? "" : input.handle.trim()
    if (trimmed === "") {
      handle = null
    } else {
      if (!isValidHandle(trimmed)) throw new InvalidHandleError()
      handle = normalizeHandle(trimmed)
    }
  }

  // Pre-check uniqueness against OTHER wallets so we can give a clean
  // error before attempting the write. The unique index is the real
  // backstop (race window), caught below.
  if (handle) {
    const [conflict] = await db
      .select({ wallet: playerProfiles.wallet })
      .from(playerProfiles)
      .where(
        and(
          eq(playerProfiles.handle, handle),
          ne(playerProfiles.wallet, checksum)
        )
      )
      .limit(1)
    if (conflict) throw new HandleTakenError()
  }

  const clean = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : v.trim() || null

  const displayName = clean(input.displayName)
  const bio = clean(input.bio)
  const avatarUrl = clean(input.avatarUrl)
  const now = new Date()

  // Build the partial update set: only columns the caller addressed.
  const updateSet: Record<string, unknown> = { updatedAt: now }
  if (handle !== undefined) updateSet.handle = handle
  if (displayName !== undefined) updateSet.displayName = displayName
  if (bio !== undefined) updateSet.bio = bio
  if (avatarUrl !== undefined) updateSet.avatarUrl = avatarUrl

  try {
    const [row] = await db
      .insert(playerProfiles)
      .values({
        wallet: checksum,
        handle: handle ?? null,
        displayName: displayName ?? null,
        bio: bio ?? null,
        avatarUrl: avatarUrl ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: playerProfiles.wallet,
        set: updateSet,
      })
      .returning()
    return row
  } catch (err) {
    if (isUniqueViolation(err)) throw new HandleTakenError()
    throw err
  }
}
