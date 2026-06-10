/**
 * Tiny fetch wrappers for the attendee surface so the React components
 * don't repeat URL strings or response-shape parsing.
 */

import { type Address, type Hex } from "viem"

export interface PublicProgress {
  address: Address
  scanned: string[]
  total: number
  finished: boolean
  badgeMintedAt: number | null
  startedAt: number
  lastScanAt: number | null
}

async function jsonFetch<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let body: { error?: string; message?: string } = {}
    try {
      body = (await res.json()) as { error?: string; message?: string }
    } catch {
      // body wasn't JSON; ignore
    }
    const err = new Error(body.message ?? body.error ?? res.statusText)
    ;(err as Error & { status?: number; code?: string }).status = res.status
    ;(err as Error & { status?: number; code?: string }).code = body.error
    throw err
  }
  return (await res.json()) as T
}

// ─────────────────── Auth ───────────────────

export async function requestNonce(): Promise<{ nonce: string }> {
  return jsonFetch("/api/play/auth/nonce")
}

export async function verifySiwe(args: {
  message: string
  signature: string
}): Promise<{ ok: boolean; address: Address }> {
  return jsonFetch("/api/play/auth/verify", {
    method: "POST",
    body: JSON.stringify(args),
  })
}

export async function getSession(): Promise<{
  address: Address | null
  chainId: number | null
  issuedAt: number | null
}> {
  return jsonFetch("/api/play/auth/me")
}

export async function logout(): Promise<{ ok: true }> {
  return jsonFetch("/api/play/auth/logout", { method: "POST" })
}

// ─────────────────── Event sheet ───────────────────

export interface PlayCheckpoint {
  id: string
  name: string
  area: string | null
  sponsor: string | null
  clue: string | null
  clueType: "scan" | "staff" | "pair" | "nfc"
  orderIndex: number
}

export interface PlayEvent {
  name: string
  venue: string | null
  network: string
  checkpoints: PlayCheckpoint[]
}

export async function getPlayEvent(): Promise<{ event: PlayEvent }> {
  return jsonFetch("/api/play/event")
}

/** Block-explorer link for a confirmed tx, by event network. */
export function explorerTxUrl(network: string, txHash: string): string {
  const base =
    network === "base"
      ? "https://basescan.org"
      : "https://sepolia.basescan.org"
  return `${base}/tx/${txHash}`
}

/** "base-sepolia" → "Base Sepolia" for footers and badges. */
export function networkLabel(network: string): string {
  return network
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Whether the player should be treated as already-minted.
 *
 * The server DB (`badgeMintedAt`) and the chain (`onchainHeld`) are two
 * independent records of the same fact. We trust either one in the
 * "already minted" direction: if the chain says the wallet holds the
 * badge we honour it even when the DB has no record (resilience to a
 * server wipe / rollback), and vice versa. When the badge contract
 * isn't configured `onchainHeld` is null and only the DB matters.
 */
export function isAlreadyMinted(args: {
  badgeMintedAt: number | null | undefined
  onchainHeld: boolean | null
}): boolean {
  return Boolean(args.badgeMintedAt) || args.onchainHeld === true
}

// ─────────────────── Game state ───────────────────

export async function getProgress(): Promise<{
  progress: PublicProgress
  total: number
}> {
  return jsonFetch("/api/play/progress")
}

export async function recordScan(args: {
  checkpointId: string
  /** Manual TOTP code; optional when a signed URL token is supplied. */
  code?: string
  /** HMAC-signed URL token from a tap-to-scan flow (`/play/scan?…&t=…`). */
  t?: string
}): Promise<{ progress: PublicProgress }> {
  return jsonFetch("/api/play/scan", {
    method: "POST",
    body: JSON.stringify(args),
  })
}

// ─────────────────── Mint ───────────────────

export interface MintPermitResponse {
  contract: Address
  chainId: number
  permit: {
    player: Address
    chainId: string
    nonce: Hex
    deadline: string
  }
  signature: Hex
}

export async function requestMintPermit(): Promise<MintPermitResponse> {
  return jsonFetch("/api/play/mint-permit", { method: "POST" })
}

export async function confirmMint(args: {
  txHash: Hex
  tokenId?: number
}): Promise<{ ok: boolean; badgeMintedAt: number; txHash: Hex }> {
  return jsonFetch("/api/play/mint-confirm", {
    method: "POST",
    body: JSON.stringify(args),
  })
}
