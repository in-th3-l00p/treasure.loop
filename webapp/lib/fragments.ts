import { randomInt } from "node:crypto"

/**
 * Pair-fragment helpers (ROADMAP Phase 7).
 *
 * A pair checkpoint hands each player a short, spoken-aloud-friendly code.
 * Two players read their codes to each other and one of them types the
 * other's in to combine. Because the code travels by voice and thumb, the
 * alphabet matters: we drop every glyph that's ambiguous out loud or on a
 * cramped phone keyboard.
 */

/**
 * Curated, unambiguous alphabet. Excludes every glyph that's easy to
 * confuse out loud or on a phone keyboard:
 *   - 0 / O
 *   - 1 / I / L
 * What's left is 8 digits (2-9) + 23 letters (A-Z minus I, L, O) = 31
 * symbols. (The ROADMAP calls this "32-symbol"; the named exclusions can
 * only yield 31, and unambiguity is the requirement that matters, so we
 * keep the 31 unambiguous symbols rather than re-add a look-alike to hit
 * a round power of two. `randomInt` stays unbiased over any range.)
 */
export const FRAGMENT_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

/** Code length. 5 chars over 31 symbols = 31^5 ≈ 28.6M distinct codes. */
export const FRAGMENT_CODE_LENGTH = 5

// Guard against an accidental edit re-introducing an ambiguous glyph or
// dropping a symbol.
if (
  FRAGMENT_ALPHABET.length !== 31 ||
  /[01ILO]/.test(FRAGMENT_ALPHABET) ||
  new Set(FRAGMENT_ALPHABET).size !== FRAGMENT_ALPHABET.length
) {
  throw new Error(
    "FRAGMENT_ALPHABET must be 31 unique, unambiguous symbols (no 0/1/I/L/O)"
  )
}

/**
 * Generate a fresh short code from the curated alphabet using crypto
 * randomness (`randomInt` is unbiased over the 32-symbol range). Codes
 * are scoped per (event, checkpoint) by a unique index, so a rare
 * collision is caught at insert time and the caller retries.
 */
export function generateShortCode(): string {
  let out = ""
  for (let i = 0; i < FRAGMENT_CODE_LENGTH; i++) {
    out += FRAGMENT_ALPHABET[randomInt(FRAGMENT_ALPHABET.length)]
  }
  return out
}

/**
 * Normalize a player-entered code for lookup: uppercase and strip
 * whitespace and dashes. We intentionally do NOT fold the excluded
 * look-alikes (0/O, 1/I/L) — they aren't in the alphabet, so a genuine
 * typo should fail honestly rather than be coerced into a false match.
 */
export function normalizeShortCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "")
}

/** A complete fragment as returned to the client. */
export interface IssuedFragment {
  kind: "A" | "B"
  shortCode: string
}
