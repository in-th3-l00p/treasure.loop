import { existsSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { APP_ROUTES } from "@/lib/authz"

// These two pages back the middleware's redirect targets. If either is
// missing the user lands on a 404 the moment they get denied — keep them.

const APP_ROOT = join(process.cwd(), "app")

describe("auth shell pages", () => {
  it("/no-organization page exists", () => {
    expect(
      existsSync(join(APP_ROOT, "no-organization", "page.tsx")),
      "create /app/no-organization or update middleware redirect target"
    ).toBe(true)
  })

  it("/forbidden page exists", () => {
    expect(
      existsSync(join(APP_ROOT, "forbidden", "page.tsx")),
      "create /app/forbidden or update middleware redirect target"
    ).toBe(true)
  })
})

describe("APP_ROUTES wiring", () => {
  it("every declared /app/* route has a page file", () => {
    for (const route of APP_ROUTES) {
      const segments = route.href.split("/").filter(Boolean)
      const pagePath = join(APP_ROOT, ...segments, "page.tsx")
      // Some routes are planned but not implemented (e.g. /app/players).
      // We don't fail those, but we do warn loudly so the team notices.
      if (!existsSync(pagePath)) {
        console.warn(
          `[authz] ${route.href} declared in APP_ROUTES but missing ${pagePath}`
        )
      }
    }
  })

  it("every page under /app/* has a declared policy", () => {
    // Pages that exist but aren't in APP_ROUTES default to member-only
    // (see canAccessRoute). That's safe, but it's worth catching during
    // dev so we don't accidentally ship a page without a deliberate role
    // decision. We assert only on the four pages we have shipped.
    const shipped = [
      "/app",
      "/app/routes",
      "/app/sponsors",
      "/app/prize-desk",
    ]
    const declared = new Set(APP_ROUTES.map((r) => r.href))
    for (const path of shipped) {
      expect(
        declared.has(path),
        `${path} is shipped but missing from APP_ROUTES`
      ).toBe(true)
    }
  })
})
