import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { drizzle } from "drizzle-orm/pglite"

import * as schema from "@/db/schema"

/**
 * Spin up a fresh in-memory Postgres via PGlite, apply the migrations,
 * and return a Drizzle client. Tests use this to exercise the real
 * SQL — no mocking, no remote DB required.
 */
export async function newTestDb() {
  const client = await PGlite.create({ extensions: { pgcrypto } })
  await client.exec("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
  const db = drizzle({ client, schema, casing: "snake_case" })

  const migrationsDir = join(process.cwd(), "db", "migrations")
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  for (const file of files) {
    const body = readFileSync(join(migrationsDir, file), "utf-8")
    // Skip the CREATE EXTENSION line — pgcrypto already loaded above and
    // PGlite doesn't ship that bundle by default.
    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !/CREATE EXTENSION/i.test(s))
    for (const stmt of statements) {
      await client.exec(stmt)
    }
  }
  return { client, db }
}

/**
 * Seed a minimal event with N checkpoints and return the ids needed
 * by player-store tests.
 */
export async function seedTestEvent(
  db: Awaited<ReturnType<typeof newTestDb>>["db"],
  checkpointCount = 5
) {
  // Unique per call so a single test can seed multiple events without
  // tripping the `events.org_id` unique index.
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  const [event] = await db
    .insert(schema.events)
    .values({
      orgId: `org_test_${stamp}`,
      name: `Test Event ${stamp}`,
      slug: `test-${stamp}`,
      status: "live_rehearsal",
    })
    .returning()

  const [route] = await db
    .insert(schema.routes)
    .values({ eventId: event.id, name: "Test Route", published: true })
    .returning()

  const checkpoints = await db
    .insert(schema.checkpoints)
    .values(
      Array.from({ length: checkpointCount }, (_, i) => ({
        eventId: event.id,
        routeId: route.id,
        orderIndex: i + 1,
        name: `Checkpoint ${i + 1}`,
      }))
    )
    .returning()

  return {
    event,
    route,
    checkpoints,
    checkpointIds: checkpoints.map((c) => c.id),
  }
}
