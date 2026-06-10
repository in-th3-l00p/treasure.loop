/**
 * Seed the dev database with the ETH Cluj 2026 pilot data.
 *
 * Idempotent: re-running drops and recreates the event.
 */

import { sql as drizzleSql } from "drizzle-orm"
import postgres from "postgres"

import { drizzle } from "drizzle-orm/postgres-js"

import {
  currentCode,
  generateCheckpointSecret,
} from "../lib/checkpoint-codes"
import * as schema from "./schema"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is required to run seed.")
  }

  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { schema, casing: "snake_case" })

  // Wipe the dev event (cascade) so we can re-run idempotently.
  await db.execute(drizzleSql`
    DELETE FROM events WHERE slug = 'eth-cluj-2026'
  `)

  const [event] = await db
    .insert(schema.events)
    .values({
      // Set SEED_ORG_ID to your Clerk organization id so the operator
      // console (which scopes events by org) shows this seeded event and
      // doesn't auto-provision a second empty one. Defaults to a dev id
      // that's fine for the attendee /play surface alone.
      orgId: process.env.SEED_ORG_ID ?? "org_dev_seed",
      name: "ETH Cluj 2026: TreasureLoop Pilot",
      slug: "eth-cluj-2026",
      venue: "Cluj Innovation Hall",
      datesStart: new Date("2026-07-17T08:00:00Z"),
      datesEnd: new Date("2026-07-19T18:00:00Z"),
      network: "base-sepolia",
      status: "live_rehearsal",
      // The pilot is fully configured — don't nag it with the onboarding
      // wizard. `rehearsal` (the dress-rehearsal mint flag) defaults false.
      onboardedAt: new Date(),
      badgeContractAddress:
        process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS ?? null,
    })
    .returning()
  console.log(`[seed] event ${event.id}`)

  const [route] = await db
    .insert(schema.routes)
    .values({ eventId: event.id, name: "Cluj Loop 01", published: true })
    .returning()
  console.log(`[seed] route ${route.id}`)

  const sponsorsData = [
    { name: "InTheLoop", tier: "community" as const },
    { name: "Neon Labs", tier: "gold" as const },
    { name: "Ledger", tier: "prize" as const },
    { name: "Lisk", tier: "gold" as const },
    { name: "ETH Cluj", tier: "community" as const },
  ]
  const sponsorRows = await db
    .insert(schema.sponsors)
    .values(sponsorsData.map((s) => ({ ...s, eventId: event.id })))
    .returning()
  const sponsorByName = new Map(sponsorRows.map((s) => [s.name, s.id]))
  console.log(`[seed] ${sponsorRows.length} sponsors`)

  const checkpointSpecs = [
    {
      name: "Opening Gate",
      area: "Registration atrium",
      clue: "Find the signal that starts the loop.",
      clueType: "scan" as const,
      sponsorName: "InTheLoop",
    },
    {
      name: "Builder Alley",
      area: "Sponsor row A",
      clue: "Ask for the opcode hidden in plain sight.",
      clueType: "staff" as const,
      sponsorName: "Neon Labs",
    },
    {
      name: "Hardware Vault",
      area: "Security lounge",
      clue: "Two fragments unlock the vault phrase.",
      clueType: "pair" as const,
      sponsorName: "Ledger",
    },
    {
      name: "Protocol Garden",
      area: "Outdoor terrace",
      clue: "Find another player holding the matching shard.",
      clueType: "pair" as const,
      sponsorName: "Lisk",
    },
    {
      name: "Prize Desk",
      area: "Main hall exit",
      clue: "Close the loop and claim your proof.",
      clueType: "scan" as const,
      sponsorName: "ETH Cluj",
    },
  ]
  const cps = await db
    .insert(schema.checkpoints)
    .values(
      checkpointSpecs.map((c, i) => ({
        eventId: event.id,
        routeId: route.id,
        orderIndex: i + 1,
        name: c.name,
        area: c.area,
        clue: c.clue,
        clueType: c.clueType,
        sponsorId: sponsorByName.get(c.sponsorName) ?? null,
        totpSecret: generateCheckpointSecret(),
      }))
    )
    .returning()
  console.log(`[seed] ${cps.length} checkpoints`)
  console.log("[seed] current codes (regenerate every 30s):")
  for (const cp of cps) {
    if (cp.totpSecret) {
      console.log(`  ${cp.name.padEnd(20)} ${currentCode(cp.totpSecret, cp.name)}`)
    }
  }

  const rewardsData = [
    { name: "On-chain finisher badge", stockTotal: null, status: "minting" as const },
    { name: "Ledger Nano raffle", stockTotal: 120, status: "open" as const },
    { name: "Speaker dinner pass", stockTotal: 16, status: "limited" as const },
    { name: "Conference merch pack", stockTotal: 200, status: "open" as const },
  ]
  const rw = await db
    .insert(schema.rewards)
    .values(rewardsData.map((r) => ({ ...r, eventId: event.id })))
    .returning()
  console.log(`[seed] ${rw.length} rewards`)

  await client.end({ timeout: 1 })
  console.log("[done]")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
