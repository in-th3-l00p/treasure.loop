import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error(
    "DATABASE_URL must be set when running drizzle-kit. " +
      "For local dev: postgres://postgres:postgres@localhost:5432/treasureloop. " +
      "For Neon: paste the connection string from your Neon project."
  )
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
})
