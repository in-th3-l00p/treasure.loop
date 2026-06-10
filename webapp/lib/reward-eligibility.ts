/**
 * Reward eligibility engine (Phase 5).
 *
 * Rewards carry an optional `eligibility_rule` (jsonb). The prize desk
 * evaluates it against a small, fully-derived context for the looked-up
 * wallet so staff see *which* rewards a wallet qualifies for and *why*.
 *
 * Everything here is pure and dependency-free so it can be imported from
 * both server (the redeem re-check) and client (the verifier UI) code,
 * and unit-tested directly without a DB or a chain.
 */

/**
 * The typed rule union. Stored as jsonb on `rewards.eligibility_rule`.
 *
 *   - `any-minted`    — any wallet that currently holds the finisher
 *                       badge on chain. This is also the implicit
 *                       default when the column is null.
 *   - `first-n-mints` — only the first N players to mint (ranked by
 *                       `badge_mints.minted_at`, 1-based). Door-buster
 *                       tiers, "first 100 finishers", etc.
 *   - `min-scans`     — wallet must have visited at least N checkpoints
 *                       (its `scans` count). Rewards thoroughness.
 */
export type EligibilityRule =
  | { type: "any-minted" }
  | { type: "first-n-mints"; n: number }
  | { type: "min-scans"; n: number }

/** The default applied when a reward has no explicit rule. */
export const DEFAULT_RULE: EligibilityRule = { type: "any-minted" }

/**
 * Everything the engine needs to judge one wallet against one rule.
 *
 *   - `holdsBadge` — does the wallet currently hold the badge on chain?
 *                    (When the contract isn't configured the caller
 *                    passes the DB's view so dev demos still work.)
 *   - `mintRank`   — 1-based position in mint order, or null if the
 *                    wallet has no recorded mint.
 *   - `scanCount`  — how many checkpoints the wallet scanned.
 */
export interface EligibilityContext {
  holdsBadge: boolean
  mintRank: number | null
  scanCount: number
}

export interface EligibilityResult {
  eligible: boolean
  reason: string
}

/**
 * Narrow an unknown jsonb value to a known rule, falling back to the
 * default for null / unrecognized shapes. Keeps bad data in the DB from
 * crashing the desk — an unknown rule degrades to "any minted holder."
 */
export function normalizeRule(raw: unknown): EligibilityRule {
  if (!raw || typeof raw !== "object") return DEFAULT_RULE
  const rule = raw as { type?: unknown; n?: unknown }
  switch (rule.type) {
    case "any-minted":
      return { type: "any-minted" }
    case "first-n-mints":
      return {
        type: "first-n-mints",
        n: typeof rule.n === "number" ? rule.n : 0,
      }
    case "min-scans":
      return { type: "min-scans", n: typeof rule.n === "number" ? rule.n : 0 }
    default:
      return DEFAULT_RULE
  }
}

/**
 * Pure evaluation. Returns whether the wallet qualifies plus a short,
 * human reason staff can read aloud at the counter.
 */
export function evaluateEligibility(
  rule: EligibilityRule | null | undefined,
  ctx: EligibilityContext
): EligibilityResult {
  const r = rule ?? DEFAULT_RULE

  // Holding the badge is a precondition for every rule — a reward is
  // never handed to a wallet that doesn't actually own a finisher badge.
  if (!ctx.holdsBadge) {
    return { eligible: false, reason: "Wallet does not hold a finisher badge." }
  }

  switch (r.type) {
    case "any-minted":
      return { eligible: true, reason: "Holds a finisher badge." }

    case "first-n-mints": {
      if (ctx.mintRank === null) {
        return { eligible: false, reason: "No recorded mint for this wallet." }
      }
      if (ctx.mintRank <= r.n) {
        return {
          eligible: true,
          reason: `Mint #${ctx.mintRank} — within the first ${r.n}.`,
        }
      }
      return {
        eligible: false,
        reason: `Mint #${ctx.mintRank} — past the first ${r.n}.`,
      }
    }

    case "min-scans": {
      if (ctx.scanCount >= r.n) {
        return {
          eligible: true,
          reason: `Scanned ${ctx.scanCount} checkpoints (needs ${r.n}).`,
        }
      }
      return {
        eligible: false,
        reason: `Scanned ${ctx.scanCount} of ${r.n} required checkpoints.`,
      }
    }
  }
}

/** A short label for the rule, for chips/tooltips in the desk UI. */
export function describeRule(rule: EligibilityRule | null | undefined): string {
  const r = rule ?? DEFAULT_RULE
  switch (r.type) {
    case "any-minted":
      return "Any badge holder"
    case "first-n-mints":
      return `First ${r.n} mints`
    case "min-scans":
      return `≥ ${r.n} scans`
  }
}
