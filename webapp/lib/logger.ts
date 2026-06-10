/**
 * Structured request logger for the play API.
 *
 * DECISION — minimal dependency-free logger, NOT pino.
 *
 * `pino` is excellent in a long-lived Node process, but it is a poor fit
 * here: its fast transports use worker threads and `process.stdout`
 * tricks that are unreliable in serverless Functions and outright break
 * in the Edge runtime. Next 16 evaluates route + instrumentation modules
 * in both runtimes, so a pino import risks a build/runtime failure for
 * no real gain at our volume. Instead we emit one JSON object per line
 * via `console.log` — captured verbatim by Vercel / any log drain, and
 * parseable by every aggregator. This mirrors the pragmatic "no extra
 * integration" stance in `lib/rate-limit.ts` and `lib/play-session.ts`.
 *
 * The line shape is stable so downstream queries can rely on it:
 *   { ts, level, msg, requestId, route, method, status, outcome,
 *     latencyMs, actor?, ...fields }
 */

import { captureException } from "@/lib/observability"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogFields {
  requestId?: string
  route?: string
  method?: string
  status?: number
  /** Coarse result bucket, independent of HTTP status. */
  outcome?: "ok" | "client_error" | "server_error" | "rejected"
  latencyMs?: number
  /** Wallet address / Clerk user id when known. Never log secrets. */
  actor?: string | null
  /** Anything else worth structuring. */
  [key: string]: unknown
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Minimum level to emit. `LOG_LEVEL` env overrides; defaults to `debug`
 * in dev and `info` in production so test runs stay quiet-ish but
 * production keeps the useful request lines.
 */
function minLevel(): number {
  const env = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  if (env && env in LEVEL_RANK) return LEVEL_RANK[env]
  return process.env.NODE_ENV === "production"
    ? LEVEL_RANK.info
    : LEVEL_RANK.debug
}

function emit(level: LogLevel, msg: string, fields: LogFields = {}): void {
  if (LEVEL_RANK[level] < minLevel()) return
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  }
  // One JSON object per line. console.error for error level so it lands
  // on stderr; everything else on stdout.
  const sink = level === "error" ? console.error : console.log
  try {
    sink(JSON.stringify(line))
  } catch {
    // Circular field or similar — fall back to a safe stringify.
    sink(JSON.stringify({ ts: line.ts, level, msg, requestId: fields.requestId }))
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
}

/** Stable request id. Prefers an upstream id (Vercel / proxy) when present. */
function requestIdFor(req: Request): string {
  const upstream =
    req.headers.get("x-request-id") ||
    req.headers.get("x-vercel-id") ||
    req.headers.get("cf-ray")
  if (upstream) return upstream
  // `crypto` is globally available in both Node 20+ and the Edge runtime.
  return crypto.randomUUID()
}

/** Map an HTTP status to a coarse outcome bucket. */
function outcomeFor(status: number): NonNullable<LogFields["outcome"]> {
  if (status >= 500) return "server_error"
  if (status === 429 || status === 401 || status === 403) return "rejected"
  if (status >= 400) return "client_error"
  return "ok"
}

export interface RouteContext {
  requestId: string
  route: string
  /** Attach extra structured fields (e.g. actor, checkpointId) to the outcome line. */
  set: (fields: LogFields) => void
}

type RouteHandler<A extends unknown[]> = (
  req: Request,
  ctx: RouteContext,
  ...args: A
) => Promise<Response> | Response

/**
 * Wrap an API route handler with request-id propagation, timing, and a
 * single structured outcome line. Does NOT change the response body or
 * status — it only observes. A thrown error is logged, forwarded to the
 * (inert-by-default) Sentry wrapper, and re-thrown so Next's own error
 * handling is unaffected.
 *
 * Usage:
 *   export const POST = withRouteLogging("play/scan", async (req, ctx) => {
 *     ctx.set({ actor: address })
 *     return NextResponse.json(...)
 *   })
 */
export function withRouteLogging<A extends unknown[]>(
  route: string,
  handler: RouteHandler<A>
): (req: Request, ...args: A) => Promise<Response> {
  return async (req: Request, ...args: A): Promise<Response> => {
    const requestId = requestIdFor(req)
    const start = Date.now()
    const extra: LogFields = {}
    const ctx: RouteContext = {
      requestId,
      route,
      set: (fields) => Object.assign(extra, fields),
    }

    logger.debug("request.start", {
      requestId,
      route,
      method: req.method,
      ...extra,
    })

    try {
      const res = await handler(req, ctx, ...args)
      const latencyMs = Date.now() - start
      const status = res.status
      const outcome = outcomeFor(status)
      logger[outcome === "server_error" ? "error" : "info"]("request.end", {
        requestId,
        route,
        method: req.method,
        status,
        outcome,
        latencyMs,
        ...extra,
      })
      // Surface the request id to clients + log drains for correlation.
      try {
        res.headers.set("x-request-id", requestId)
      } catch {
        // Some responses have immutable headers; non-fatal.
      }
      return res
    } catch (err) {
      const latencyMs = Date.now() - start
      logger.error("request.error", {
        requestId,
        route,
        method: req.method,
        status: 500,
        outcome: "server_error",
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
        ...extra,
      })
      captureException(err, { requestId, route, ...extra })
      throw err
    }
  }
}
