import { type Address, getAddress } from "viem"

import { checkpoints } from "./mock-data"

/**
 * Server-side player progress store.
 *
 * For the prototype this is a single in-process Map: every player's
 * scanned checkpoint set, keyed by checksummed wallet address. It
 * resets on dev-server reload, which is fine for an event-day
 * prototype. The interface below is the seam where Postgres/KV slots
 * in for the real deployment.
 *
 * Why a thin module instead of inline maps in route files:
 *   - one place owns the invariant "addresses are checksummed"
 *   - tests can replace `store` with a fixture
 *   - swapping to a real DB doesn't touch routes
 */

export interface PlayerProgress {
  address: Address
  scanned: string[] // checkpoint ids, ordered by scan time
  startedAt: number
  lastScanAt: number | null
  badgeMintedAt: number | null
}

const VALID_CHECKPOINT_IDS = new Set(checkpoints.map((c) => c.id))

export function isValidCheckpoint(id: string): boolean {
  return VALID_CHECKPOINT_IDS.has(id)
}

export function totalCheckpoints(): number {
  return checkpoints.length
}

class InMemoryStore {
  private players = new Map<Address, PlayerProgress>()

  get(address: Address): PlayerProgress | null {
    return this.players.get(getAddress(address)) ?? null
  }

  /** Idempotently creates the player record if it didn't exist. */
  ensure(address: Address): PlayerProgress {
    const key = getAddress(address)
    const existing = this.players.get(key)
    if (existing) return existing
    const fresh: PlayerProgress = {
      address: key,
      scanned: [],
      startedAt: Date.now(),
      lastScanAt: null,
      badgeMintedAt: null,
    }
    this.players.set(key, fresh)
    return fresh
  }

  /**
   * Record a scan. Returns the updated progress, or null if the
   * checkpoint id is invalid. Re-scanning an already-solved checkpoint
   * is a no-op (idempotent) so a flaky NFC read can't reset progress.
   */
  scan(address: Address, checkpointId: string): PlayerProgress | null {
    if (!isValidCheckpoint(checkpointId)) return null
    const player = this.ensure(address)
    if (!player.scanned.includes(checkpointId)) {
      player.scanned = [...player.scanned, checkpointId]
      player.lastScanAt = Date.now()
    }
    return player
  }

  /**
   * Mark the player's badge as minted. Returns null if the player isn't
   * eligible (hasn't solved every checkpoint yet) or has already
   * minted.
   */
  recordBadgeMint(address: Address): PlayerProgress | null {
    const player = this.players.get(getAddress(address))
    if (!player) return null
    if (player.scanned.length < totalCheckpoints()) return null
    if (player.badgeMintedAt) return null
    player.badgeMintedAt = Date.now()
    return player
  }

  reset(): void {
    this.players.clear()
  }

  size(): number {
    return this.players.size
  }
}

export const playerStore = new InMemoryStore()

/** Convenience: did this address finish the loop? */
export function hasFinishedLoop(progress: PlayerProgress): boolean {
  return progress.scanned.length >= totalCheckpoints()
}

/** Shape returned to the client — never include server-only fields. */
export interface PublicProgress {
  address: Address
  scanned: string[]
  total: number
  finished: boolean
  badgeMintedAt: number | null
  startedAt: number
  lastScanAt: number | null
}

export function toPublicProgress(p: PlayerProgress): PublicProgress {
  return {
    address: p.address,
    scanned: p.scanned,
    total: totalCheckpoints(),
    finished: hasFinishedLoop(p),
    badgeMintedAt: p.badgeMintedAt,
    startedAt: p.startedAt,
    lastScanAt: p.lastScanAt,
  }
}
