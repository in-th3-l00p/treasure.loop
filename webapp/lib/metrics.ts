/**
 * In-process counters for product + reliability metrics.
 *
 * Why in-memory: same trade-off as `lib/rate-limit.ts` — a real
 * analytics sink (PostHog / a /metrics Prometheus scrape / Vercel
 * Analytics) is the production answer, but standing one up would gate
 * this on credentials. The interface below is deliberately the shape
 * we'd keep when we wire that sink: `increment(name, labels?)` becomes
 * a fire-to-sink, `snapshot()` stays as a debug/health read.
 *
 * Caveat (carried from rate-limit): on serverless these counters are
 * per-instance and reset on cold start, so `snapshot()` is a local view,
 * not a global total. Good enough for a health endpoint and for the
 * drop-in seam; not a substitute for the eventual sink.
 *
 * Labels are folded into the key as a stable, sorted suffix so
 * `increment("scan", { outcome: "ok" })` and the unlabeled `scan` are
 * distinct series.
 */

export type MetricLabels = Record<string, string | number | boolean>

const counters = new Map<string, number>()

/** Deterministic `name{k=v,k2=v2}` key from a metric name + labels. */
function keyFor(name: string, labels?: MetricLabels): string {
  if (!labels) return name
  const entries = Object.entries(labels)
  if (entries.length === 0) return name
  const body = entries
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join(",")
  return `${name}{${body}}`
}

/** Add `by` (default 1) to a counter series. */
export function increment(
  name: string,
  labels?: MetricLabels,
  by = 1
): void {
  const key = keyFor(name, labels)
  counters.set(key, (counters.get(key) ?? 0) + by)
  // DROP-IN SEAM: when an analytics sink is wired, also fire here, e.g.
  //   void sink.track(name, { ...labels, by })
}

/** Read the current value of one series (0 if never incremented). */
export function getCounter(name: string, labels?: MetricLabels): number {
  return counters.get(keyFor(name, labels)) ?? 0
}

/** Plain object of every series → value. Safe to JSON-serialize. */
export function snapshot(): Record<string, number> {
  return Object.fromEntries(counters)
}

/** Test-only: clear every counter. */
export function __resetMetrics(): void {
  counters.clear()
}

/**
 * Canonical metric names. Centralized so call sites can't drift on
 * spelling and a dashboard knows what to look for.
 */
export const Metric = {
  Scan: "play.scan",
  Mint: "play.mint",
  Redemption: "play.redemption",
  Error: "play.error",
} as const
