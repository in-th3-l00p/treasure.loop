import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js"
import { neon } from "@neondatabase/serverless"
import postgres from "postgres"

import * as schema from "./schema"

/**
 * Database client selection.
 *
 * - **Production / preview**: a Neon database. We use the HTTP driver
 *   so each serverless invocation gets its own short-lived connection.
 * - **Local dev / CI**: a plain Postgres instance over a TCP pool
 *   (the `postgres` driver). Bring it up with the docker-compose at
 *   the repo root, or via Brew (`brew services start postgresql@16`).
 *
 * Switching is by URL: if `DATABASE_URL` matches `neon.tech` we use
 * the HTTP driver, otherwise we use `postgres`. The two drivers
 * expose the same Drizzle interface so the rest of the app doesn't
 * care which is active.
 */

const url = process.env.DATABASE_URL

if (!url && process.env.NODE_ENV !== "test") {
  // Build-time imports may happen without a DB; we surface a clearer
  // error than "undefined.length" when an API route tries to query.
  // (Tests bypass this by injecting their own client.)
  console.warn(
    "[db] DATABASE_URL is not set. API routes that hit the database will fail."
  )
}

type Schema = typeof schema

function buildDb() {
  if (!url) {
    // Lazy stub so importing this module doesn't blow up; throws on use.
    return new Proxy(
      {},
      {
        get() {
          throw new Error(
            "DATABASE_URL is not configured. See webapp/README.md."
          )
        },
      }
    ) as unknown as ReturnType<typeof drizzlePg<Schema>>
  }

  if (url.includes("neon.tech")) {
    const sql = neon(url)
    return drizzleNeon({ client: sql, schema, casing: "snake_case" })
  }

  const client = postgres(url, { prepare: false, max: 5 })
  return drizzlePg(client, { schema, casing: "snake_case" })
}

// Singleton — re-used across HMR boundaries in dev.
declare global {
  var __treasureloop_db: ReturnType<typeof buildDb> | undefined
}

export const db = globalThis.__treasureloop_db ?? buildDb()

if (process.env.NODE_ENV !== "production") {
  globalThis.__treasureloop_db = db
}

export { schema }
