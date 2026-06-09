import { TOTP, Secret } from "otpauth"

/**
 * Per-checkpoint rotating verification codes.
 *
 * Each checkpoint stores a base32 TOTP secret on `checkpoints.totp_secret`.
 * Booth staff sees the current 30s-window code on their kiosk
 * (`/app/booth/[checkpointId]`). Players type that code; the server
 * verifies with a 1-window drift tolerance to absorb clock skew.
 *
 * Why not signed HMAC over time alone:
 *   - TOTP is well-understood and battle-tested
 *   - any wallet that physically sees the staff's screen is "at the booth"
 *   - even if a code leaks, it's invalid in ≤60s
 *
 * Secret format: 32 base32 chars = 160 bits of entropy. We always
 * store the base32 string so the same secret can be displayed as a
 * QR for a Google-Authenticator-style backup if we ever need that.
 */

const DIGITS = 6
const PERIOD = 30
const ALGO = "SHA1"

function totpFor(secret: string, label = "Checkpoint"): TOTP {
  return new TOTP({
    issuer: "TreasureLoop",
    label,
    algorithm: ALGO,
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secret),
  })
}

/** Generate a fresh secret. Returns the base32 string for storage. */
export function generateCheckpointSecret(): string {
  return new Secret({ size: 20 }).base32
}

/** Returns the current 6-digit code. Use only on the staff side. */
export function currentCode(secret: string, label?: string): string {
  return totpFor(secret, label).generate()
}

/** Seconds remaining in the current TOTP window — for staff countdown UI. */
export function secondsUntilNext(nowMs: number = Date.now()): number {
  return PERIOD - Math.floor((nowMs / 1000) % PERIOD)
}

/**
 * Verify a player-submitted code against a checkpoint secret.
 * Returns true if it matches the current window or the immediately
 * previous one (±1 drift tolerance for clock skew).
 */
export function verifyCheckpointCode(
  secret: string,
  submittedCode: string
): boolean {
  if (!secret) return false
  if (!submittedCode) return false
  const cleaned = submittedCode.replace(/\s|-/g, "")
  if (!/^\d{6}$/.test(cleaned)) return false
  const delta = totpFor(secret).validate({
    token: cleaned,
    window: 1,
  })
  return delta !== null
}
