/**
 * Tiny display formatters shared by the console and play surfaces.
 * Pure functions only — safe to import from server and client code.
 */

/** `0x74f2…92b1` — wallet/tx hashes shortened for table rows. */
export function shortAddress(addr: string): string {
  if (addr.length <= 11) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Relative time for activity feeds: "just now", "4 min ago", "2h ago". */
export function timeAgo(date: Date | number, now = Date.now()): string {
  const ms = now - (typeof date === "number" ? date : date.getTime())
  if (ms < 60_000) return "just now"
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** `14:38` — wall-clock minute for redemption/scan logs. */
export function clockTime(date: Date): string {
  return date.toISOString().slice(11, 16)
}
