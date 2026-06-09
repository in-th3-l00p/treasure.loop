/**
 * Migration runner.
 *
 * `drizzle-kit migrate` is the canonical way but it tends to hang
 * against a long-lived connection during dev. This script does the
 * same thing but cleans up after itself so npm scripts terminate.
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import postgres from "postgres"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations.")
  }

  const sql = postgres(url, { max: 1, prepare: false })
  const migrationsDir = join(import.meta.dirname, "migrations")

  await sql`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint NOT NULL
  )`

  const applied = new Set(
    (await sql<{ hash: string }[]>`SELECT hash FROM __drizzle_migrations`).map(
      (r) => r.hash
    )
  )

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[skip] ${file}`)
      continue
    }
    console.log(`[apply] ${file}`)
    const body = readFileSync(join(migrationsDir, file), "utf-8")
    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await sql.unsafe(stmt)
    }
    await sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${file}, ${Date.now()})`
  }

  await sql.end({ timeout: 1 })
  console.log("[done]")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
