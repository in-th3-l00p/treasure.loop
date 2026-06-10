/**
 * Error-tracking wrapper — inert until a Sentry DSN is provided.
 *
 * DECISION — thin wrapper, NOT the full `@sentry/nextjs` SDK (yet).
 *
 * We don't have a Sentry account / DSN, and the full SDK is invasive for
 * this Next 16 app: it wants `sentry.{client,server,edge}.config.ts`, a
 * build-time webpack/turbopack plugin, and source-map upload credentials.
 * Wiring that in blind risks breaking `npm run build` and ships dead
 * config. Instead we expose a stable `captureException` / `captureMessage`
 * surface that is a complete NO-OP unless `SENTRY_DSN` (server) or
 * `NEXT_PUBLIC_SENTRY_DSN` (client/edge) is set. When inert it just routes
 * to the structured logger so nothing is lost.
 *
 * This matches the env-gated, build-safe pattern used by
 * `lib/badge-contract.ts` (zero-address fallback) and
 * `lib/play-session.ts` (runtime, not module-scope, assertions).
 *
 * ── TO DROP IN THE REAL SDK ──────────────────────────────────────────
 *   1. `npm i @sentry/nextjs`
 *   2. Run `npx @sentry/wizard@latest -i nextjs` OR hand-create the
 *      instrumentation config per the SDK's Next 16 guide.
 *   3. In `init()` below, call `Sentry.init({ dsn: SENTRY_DSN, ... })`.
 *   4. In `captureException`/`captureMessage`, call the Sentry equivalents
 *      when `isSentryEnabled()` (keep the logger fallback for the no-DSN
 *      case so local/dev stays inert).
 *   5. In `instrumentation.ts`, forward `onRequestError` to
 *      `Sentry.captureRequestError`.
 * Everything below already guards on the env var, so step 3/4 are the
 * only behavioral changes — the call sites never change.
 */

const SERVER_DSN = process.env.SENTRY_DSN
const PUBLIC_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

/** True only when a DSN is configured. Inert (no-op) otherwise. */
export function isSentryEnabled(): boolean {
  return Boolean(SERVER_DSN || PUBLIC_DSN)
}

/**
 * Called once from `instrumentation.ts#register`. No-op without a DSN.
 * When the SDK is dropped in, this is where `Sentry.init(...)` goes.
 */
export function initObservability(): void {
  if (!isSentryEnabled()) return
  // TODO(sentry): Sentry.init({ dsn: SERVER_DSN ?? PUBLIC_DSN, tracesSampleRate: 0.1 })
}

type Extra = Record<string, unknown>

/**
 * Report an exception. Inert default: logs a structured line via
 * console.error (kept dependency-free here to avoid an import cycle with
 * `lib/logger.ts`). With a DSN + SDK, forward to `Sentry.captureException`.
 */
export function captureException(error: unknown, extra?: Extra): void {
  if (isSentryEnabled()) {
    // TODO(sentry): Sentry.captureException(error, { extra })
    return
  }
  // Inert fallback — never throw from the reporter itself.
  try {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        msg: "captureException",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...extra,
      })
    )
  } catch {
    // swallow — observability must never break the request path
  }
}

/** Report a message/breadcrumb. Inert default mirrors captureException. */
export function captureMessage(
  message: string,
  extra?: Extra & { level?: "info" | "warning" | "error" }
): void {
  if (isSentryEnabled()) {
    // TODO(sentry): Sentry.captureMessage(message, { level, extra })
    return
  }
  try {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: extra?.level ?? "info",
        msg: "captureMessage",
        message,
        ...extra,
      })
    )
  } catch {
    // swallow
  }
}
