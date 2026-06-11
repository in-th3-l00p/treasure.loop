import { getIronSession, type SessionOptions } from "iron-session"
import { cookies } from "next/headers"
import { type Address, getAddress, isAddress } from "viem"

/**
 * Encrypted cookie session for attendees.
 *
 * Why iron-session and not JWT: we want to be able to rotate the
 * underlying wallet → player mapping server-side (e.g. force re-auth on
 * an event change) without touching the client. Encrypted-cookie
 * sessions give us that without standing up a session store.
 *
 * The session payload is intentionally small: just the wallet address
 * that proved ownership via SIWE, the chain it signed on, and an issued
 * timestamp. Everything else (progress, badge mint state) lives in the
 * server-side player store keyed by wallet address.
 */
export interface PlaySession {
  address?: Address
  chainId?: number
  issuedAt?: number
  /** Per-session nonce held server-side while we wait for the signed verify. */
  pendingNonce?: string
  /**
   * The event the player is currently inside. Set when they enter an
   * event's play surface (`/e/[slug]/play`). The play APIs scope every
   * read/write to this event; absent, they fall back to the single live
   * event (`currentEventId`) for backward compatibility.
   */
  activeEventId?: string
}

const SESSION_PASSWORD =
  process.env.PLAY_SESSION_SECRET ??
  // Dev fallback so the app boots without configuration. NEVER ship to
  // production without setting PLAY_SESSION_SECRET to a 32+ char value.
  "dev-only-fallback-iron-session-secret-change-me!!"

/**
 * Enforced on first request-time use, not at module scope: `next build`
 * evaluates route modules with NODE_ENV=production and no runtime env,
 * and a module-scope throw fails the build instead of the deploy.
 */
function assertProductionSecret() {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.PLAY_SESSION_SECRET
  ) {
    throw new Error(
      "PLAY_SESSION_SECRET must be set in production (>= 32 characters)."
    )
  }
}

export const SESSION_OPTIONS: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: "treasureloop_play",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Sessions are short-lived for a live event; refresh on activity.
    maxAge: 60 * 60 * 12, // 12 hours
  },
}

/** Read (or create) the session for the current request. */
export async function getPlaySession() {
  assertProductionSecret()
  const cookieStore = await cookies()
  return getIronSession<PlaySession>(cookieStore, SESSION_OPTIONS)
}

/** Returns the checksummed address if the session is authenticated, else null. */
export async function getPlayAddress(): Promise<Address | null> {
  const session = await getPlaySession()
  if (!session.address) return null
  if (!isAddress(session.address)) return null
  return getAddress(session.address)
}
