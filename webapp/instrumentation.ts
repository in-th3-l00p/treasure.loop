/**
 * Next.js instrumentation hook (App Router, Next 16).
 *
 * `register` runs once per server instance; we use it to initialize the
 * observability layer (a no-op until a Sentry DSN is set — see
 * `lib/observability.ts`).
 *
 * `onRequestError` is Next's server-side error hook. It fires for errors
 * thrown in Route Handlers, Server Components, and Server Actions. We
 * forward to the (inert-by-default) error reporter so that once a DSN is
 * provided, every server error is captured without touching route code.
 *
 * Both hooks are dependency-free and safe in the Node + Edge runtimes
 * Next evaluates this file in.
 */

import type { Instrumentation } from "next"

export async function register(): Promise<void> {
  // Avoid pulling the reporter into the Edge bundle unless we're on Node;
  // the inert wrapper is tiny but this keeps the seam clean for the real
  // SDK, which has runtime-specific init.
  const { initObservability } = await import("@/lib/observability")
  initObservability()
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const { captureException } = await import("@/lib/observability")
  captureException(err, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
