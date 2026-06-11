/**
 * Pure handle rules shared by the server profile lib and the client
 * editor. No server-only imports here so the client bundle can use the
 * same validation the API enforces.
 *
 * Handles are URL-safe identities for /u/[handle]: lowercase a–z, 0–9,
 * plus `-` and `_`, 3–32 chars.
 */

const HANDLE_RE = /^[a-z0-9_-]{3,32}$/

/** Lowercase + trim a raw handle. Does not validate. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Whether the raw handle is valid once normalized. */
export function isValidHandle(raw: string): boolean {
  return HANDLE_RE.test(normalizeHandle(raw))
}
