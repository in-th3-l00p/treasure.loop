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
// Short prefix + a URL-SAFE base64 slug: `+`→`-`, `/`→`_`, padding `=`
// stripped. These ids travel in URL paths (e.g. /app/booth/[id]) and query
// strings (/play/scan?cp=…), so raw base64 (`+`, `=`) would break routing
// and decode `+` to a space — `translate(..., '+/=', '-_')` deletes `=`.
const shortId = (prefix: string) =>
  sql`(${sql.raw(`'${prefix}_'`)} || lower(translate(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '+/=', '-_')))`

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

export const staffAlertStatus = pgEnum("staff_alert_status", [
  "open",
  "acknowledged",
])

export const fragmentKind = pgEnum("fragment_kind", ["A", "B"])

// Who can discover an event:
//   public   — listed in the global Explore directory
//   unlisted — reachable only via a shared link / QR
//   private  — host + invited operators only
export const eventVisibility = pgEnum("event_visibility", [
  "public",
  "unlisted",
  "private",
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
    /** Discovery: who can find this event. New events start unlisted. */
    visibility: eventVisibility("visibility").notNull().default("unlisted"),
    /** Short public blurb shown on the event card + detail page. */
    summary: text("summary"),
    /** Public cover image URL for the event card / hero. */
    coverImageUrl: varchar("cover_image_url", { length: 2048 }),
    /**
     * Dress-rehearsal mode. When true, the badge mint path refuses to
     * issue a production mint permit (the mint-permit route returns
     * `rehearsal-mode` and the claim screen shows a "badges aren't
     * minted on chain" state). The operator console surfaces a visible
     * "Rehearsal" indicator. Defaults false (a real, live event).
     */
    rehearsal: boolean("rehearsal").notNull().default(false),
    /**
     * When the organizer finished (or skipped) the onboarding wizard.
     * Null until then — that's how `/app` decides whether to surface the
     * guided setup flow. A configured event never gets nagged again.
     */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
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

// ─────────────────────────── staff alerts ──────────────────────────
//
// "Help me" raises from a booth kiosk. An open alert surfaces in the
// operator overview's "Needs attention" card; an organizer acknowledges
// it to clear it. Soft state only — rows are kept for the audit trail.

export const staffAlerts = pgTable(
  "staff_alerts",
  {
    id: text("id").primaryKey().default(shortId("alrt")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    raisedBy: text("raised_by").notNull(),
    kind: text("kind").notNull().default("help"),
    message: text("message"),
    status: staffAlertStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
  },
  (t) => [
    index("staff_alerts_event_status_idx").on(t.eventId, t.status),
    index("staff_alerts_checkpoint_idx").on(t.checkpointId),
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

// ───────────────────────────── fragments ───────────────────────────
//
// Pair-fragment flow (ROADMAP Phase 7). A checkpoint with
// `clue_type = 'pair'` issues TWO complementary fragment kinds — A or B —
// alternating between players. A player who scans a pair checkpoint
// receives ONE fragment with a short, human-readable code; they must
// find a player holding the opposite kind and combine. Combining grants
// the checkpoint to BOTH wallets.
//
// A player gets at most one fragment per pair checkpoint (unique on
// player+checkpoint), so re-scanning is idempotent and returns the same
// fragment. `paired_with_player_id` / `paired_at` are null until the
// fragment is combined with its complement.

export const fragments = pgTable(
  "fragments",
  {
    id: text("id").primaryKey().default(shortId("frg")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    fragmentKind: fragmentKind("fragment_kind").notNull(),
    /** 5 chars from a 32-symbol unambiguous alphabet (no 0/O/1/I/L). */
    shortCode: varchar("short_code", { length: 5 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pairedWithPlayerId: text("paired_with_player_id").references(
      () => players.id,
      { onDelete: "set null" }
    ),
    pairedAt: timestamp("paired_at", { withTimezone: true }),
  },
  (t) => [
    // One fragment per player per pair checkpoint — re-scan is idempotent.
    uniqueIndex("fragments_player_checkpoint_idx").on(
      t.playerId,
      t.checkpointId
    ),
    // The entered code resolves a fragment within an event; codes are
    // unique per (event, checkpoint, code) so a lookup is unambiguous.
    uniqueIndex("fragments_event_checkpoint_code_idx").on(
      t.eventId,
      t.checkpointId,
      t.shortCode
    ),
    // Balancing counts the outstanding A/B per checkpoint on issuance.
    index("fragments_checkpoint_kind_idx").on(t.checkpointId, t.fragmentKind),
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

// ─────────────────────────── lead_consents ─────────────────────────
//
// Privacy-first sponsor leads. A row exists ONLY when a player explicitly
// opted in ("Share my wallet with this sponsor") at scan time for a
// sponsor-backed checkpoint. A sponsor sees individual wallets only
// through this table; the raw scan log stays organizer-only. Idempotent
// per (player, sponsor) so a re-scan never duplicates a lead.

export const leadConsents = pgTable(
  "lead_consents",
  {
    id: text("id").primaryKey().default(shortId("lc")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    checkpointId: text("checkpoint_id")
      .notNull()
      .references(() => checkpoints.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id").references(() => sponsors.id, {
      onDelete: "set null",
    }),
    wallet: varchar("wallet", { length: 42 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One consent per player + sponsor: opting in twice at the same booth
    // is a no-op, not a duplicate lead.
    uniqueIndex("lead_consents_player_sponsor_idx").on(
      t.playerId,
      t.sponsorId
    ),
    index("lead_consents_sponsor_idx").on(t.sponsorId),
    index("lead_consents_event_idx").on(t.eventId),
  ]
)

// ─────────────────────── sponsor_traffic_hourly ────────────────────
//
// Pre-aggregated booth traffic. A cron job (`/api/cron/rollup-sponsor-
// traffic`) recomputes these buckets from `scans` every few minutes so
// the read path never hot-loops over the raw scan log. The read path
// prefers this table and falls back to live aggregation when it's empty.

export const sponsorTrafficHourly = pgTable(
  "sponsor_traffic_hourly",
  {
    id: text("id").primaryKey().default(shortId("sth")),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    scanCount: integer("scan_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The bucket key: one row per sponsor per hour. The rollup upserts
    // against this so a re-run is idempotent.
    uniqueIndex("sponsor_traffic_hourly_bucket_idx").on(
      t.sponsorId,
      t.bucketStart
    ),
    index("sponsor_traffic_hourly_event_idx").on(t.eventId),
  ]
)

// ─────────────────────────── share_links ───────────────────────────
//
// Revocable, unauthenticated read-only access to a single sponsor's
// aggregate report. The token is unguessable (random base32). A link is
// valid while `revokedAt` is null; revoking flips it without deleting
// the row, so the audit trail survives.

export const shareLinks = pgTable(
  "share_links",
  {
    token: text("token").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorId: text("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("share_links_sponsor_idx").on(t.sponsorId),
    index("share_links_event_idx").on(t.eventId),
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
export type Fragment = typeof fragments.$inferSelect
export type NewFragment = typeof fragments.$inferInsert
export type BadgeMint = typeof badgeMints.$inferSelect
export type RedemptionClaim = typeof redemptionClaims.$inferSelect
export type Reward = typeof rewards.$inferSelect
export type StaffAlert = typeof staffAlerts.$inferSelect
export type NewStaffAlert = typeof staffAlerts.$inferInsert
export type LeadConsent = typeof leadConsents.$inferSelect
export type NewLeadConsent = typeof leadConsents.$inferInsert
export type SponsorTrafficHourly = typeof sponsorTrafficHourly.$inferSelect
export type ShareLink = typeof shareLinks.$inferSelect
export type NewShareLink = typeof shareLinks.$inferInsert
