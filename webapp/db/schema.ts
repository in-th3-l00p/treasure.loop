import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

import type { EligibilityRule } from "@/lib/reward-eligibility"

/**
 * TreasureLoop database schema.
 *
 * One Postgres instance can hold many events; an event is the unit of
 * scope. Every other resource (routes, checkpoints, sponsors, players,
 * scans, mints, redemptions) carries an event_id and is queried with
 * it. The Clerk Organization id mirrors `events.org_id` so we can map
 * a signed-in operator to their event without an extra lookup.
 *
 * Conventions:
 *   - all timestamps are `timestamp with time zone`
 *   - all ids are text (Clerk-style `evt_…`) so they're URL-safe and
 *     debuggable without joins
 *   - addresses are stored checksummed (we normalize at write)
 *   - rows are soft-deleted via `archived_at` rather than hard-deleted,
 *     to keep audit trail intact
 */

// Shared id generator. Postgres' `gen_random_uuid()` is too noisy in URLs.
// We use a short prefix + 16 base32 chars from pgcrypto.
const shortId = (prefix: string) =>
  sql`(${sql.raw(`'${prefix}_'`)} || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_')))`

export const checkpointStatus = pgEnum("checkpoint_status", [
  "healthy",
  "busy",
  "needs_staff",
  "offline",
])

export const sponsorTier = pgEnum("sponsor_tier", [
  "gold",
  "prize",
  "community",
])

export const clueType = pgEnum("clue_type", [
  "scan",
  "staff",
  "pair",
  "nfc",
])

export const rewardStatus = pgEnum("reward_status", [
  "open",
  "limited",
  "depleted",
  "minting",
])

// ───────────────────────────── events ─────────────────────────────

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey().default(shortId("evt")),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    venue: text("venue"),
    datesStart: timestamp("dates_start", { withTimezone: true }),
    datesEnd: timestamp("dates_end", { withTimezone: true }),
    network: text("network").notNull().default("base-sepolia"),
    badgeContractAddress: varchar("badge_contract_address", { length: 42 }),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("events_org_id_idx").on(t.orgId),
    uniqueIndex("events_slug_idx").on(t.slug),
  ]
)

// ───────────────────────────── routes ─────────────────────────────

export const routes = pgTable(
  "routes",
  {
    id: text("id").primaryKey().default(shortId("rt")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("routes_event_id_idx").on(t.eventId)]
)

// ───────────────────────────── sponsors ─────────────────────────────

export const sponsors = pgTable(
  "sponsors",
  {
    id: text("id").primaryKey().default(shortId("spn")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tier: sponsorTier("tier").notNull().default("community"),
    contactEmail: text("contact_email"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("sponsors_event_id_idx").on(t.eventId)]
)

// ─────────────────────────── checkpoints ───────────────────────────

export const checkpoints = pgTable(
  "checkpoints",
  {
    id: text("id").primaryKey().default(shortId("cp")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    routeId: text("route_id")
      .notNull()
      .references(() => routes.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    name: text("name").notNull(),
    area: text("area"),
    sponsorId: text("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    clue: text("clue"),
    clueType: clueType("clue_type").notNull().default("scan"),
    status: checkpointStatus("status").notNull().default("healthy"),
    /** Encrypted TOTP secret used to generate rotating booth codes. */
    totpSecret: text("totp_secret"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("checkpoints_event_id_idx").on(t.eventId),
    index("checkpoints_route_id_idx").on(t.routeId),
  ]
)

// ─────────────────────── staff assignments ─────────────────────────

export const staffAssignments = pgTable(
  "staff_assignments",
  {
    id: text("id").primaryKey().default(shortId("sa")),
    checkpointId: text("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("booth_staff"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_assignments_unique").on(t.checkpointId, t.userId),
  ]
)

// ───────────────────────────── rewards ─────────────────────────────

export const rewards = pgTable(
  "rewards",
  {
    id: text("id").primaryKey().default(shortId("rw")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    stockTotal: integer("stock_total"),
    stockClaimed: integer("stock_claimed").notNull().default(0),
    status: rewardStatus("status").notNull().default("open"),
    /**
     * Optional eligibility rule (see `lib/reward-eligibility.ts`). When
     * null the reward is open to any wallet holding the finisher badge.
     */
    eligibilityRule: jsonb("eligibility_rule").$type<EligibilityRule | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rewards_event_id_idx").on(t.eventId)]
)

// ───────────────────────────── players ─────────────────────────────

export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey().default(shortId("plr")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    wallet: varchar("wallet", { length: 42 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("players_event_wallet_idx").on(t.eventId, t.wallet),
    index("players_wallet_idx").on(t.wallet),
  ]
)

// ───────────────────────────── scans ─────────────────────────────

export const scans = pgTable(
  "scans",
  {
    id: text("id").primaryKey().default(shortId("sc")),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    codeHash: text("code_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("scans_player_checkpoint_idx").on(t.playerId, t.checkpointId),
    index("scans_checkpoint_idx").on(t.checkpointId),
  ]
)

// ────────────────────────── badge mints ──────────────────────────

export const badgeMints = pgTable(
  "badge_mints",
  {
    id: text("id").primaryKey().default(shortId("bm")),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    tokenId: integer("token_id"),
    mintedAt: timestamp("minted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("badge_mints_player_idx").on(t.playerId),
    uniqueIndex("badge_mints_tx_idx").on(t.txHash),
  ]
)

// ───────────────────── redemption_claims ─────────────────────────

export const redemptionClaims = pgTable(
  "redemption_claims",
  {
    id: text("id").primaryKey().default(shortId("rc")),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    rewardId: text("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "restrict" }),
    staffUserId: text("staff_user_id"),
    notes: text("notes"),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("redemption_player_reward_idx").on(t.playerId, t.rewardId),
    index("redemption_player_idx").on(t.playerId),
  ]
)

// ─────────────────────────── audit_log ─────────────────────────────

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey().default(shortId("al")),
  eventId: text("event_id"),
  actor: text("actor"),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ────────────────────── inferred row types ─────────────────────────

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Route = typeof routes.$inferSelect
export type Sponsor = typeof sponsors.$inferSelect
export type Checkpoint = typeof checkpoints.$inferSelect
export type Player = typeof players.$inferSelect
export type Scan = typeof scans.$inferSelect
export type BadgeMint = typeof badgeMints.$inferSelect
export type RedemptionClaim = typeof redemptionClaims.$inferSelect
export type Reward = typeof rewards.$inferSelect
