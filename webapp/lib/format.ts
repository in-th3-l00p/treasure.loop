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

/**
 * Calm, locale-stable event date range for discovery surfaces:
 * `Mar 12, 2026`, `Mar 12 – 14, 2026`, or `Mar 30 – Apr 2, 2026`.
 * Epoch ms in, UTC out (so SSR and client agree); null when undated.
 */
export function formatDateRange(
  startsAt: number | null,
  endsAt: number | null
): string | null {
  if (startsAt === null) return null
  const start = new Date(startsAt)
  const full = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
  if (endsAt === null || startsAt === endsAt) return full(start)
  const end = new Date(endsAt)
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  if (sameMonth) {
    const startMonthDay = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    const endDayYear = end.toLocaleDateString("en-US", {
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    return `${startMonthDay} – ${endDayYear}`
  }
  return `${full(start)} – ${full(end)}`
}
