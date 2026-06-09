CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE TYPE "public"."checkpoint_status" AS ENUM('healthy', 'busy', 'needs_staff', 'offline');--> statement-breakpoint
CREATE TYPE "public"."clue_type" AS ENUM('scan', 'staff', 'pair', 'nfc');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('open', 'limited', 'depleted', 'minting');--> statement-breakpoint
CREATE TYPE "public"."sponsor_tier" AS ENUM('gold', 'prize', 'community');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY DEFAULT ('al_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text,
	"actor" text,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_mints" (
	"id" text PRIMARY KEY DEFAULT ('bm_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"player_id" text NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"token_id" integer,
	"minted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" text PRIMARY KEY DEFAULT ('cp_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"route_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"name" text NOT NULL,
	"area" text,
	"sponsor_id" text,
	"clue" text,
	"clue_type" "clue_type" DEFAULT 'scan' NOT NULL,
	"status" "checkpoint_status" DEFAULT 'healthy' NOT NULL,
	"totp_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT ('evt_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"venue" text,
	"dates_start" timestamp with time zone,
	"dates_end" timestamp with time zone,
	"network" text DEFAULT 'base-sepolia' NOT NULL,
	"badge_contract_address" varchar(42),
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY DEFAULT ('plr_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"wallet" varchar(42) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_scan_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "redemption_claims" (
	"id" text PRIMARY KEY DEFAULT ('rc_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"player_id" text NOT NULL,
	"reward_id" text NOT NULL,
	"staff_user_id" text,
	"notes" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" text PRIMARY KEY DEFAULT ('rw_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stock_total" integer,
	"stock_claimed" integer DEFAULT 0 NOT NULL,
	"status" "reward_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY DEFAULT ('rt_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" text PRIMARY KEY DEFAULT ('sc_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"player_id" text NOT NULL,
	"checkpoint_id" text NOT NULL,
	"code_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" text PRIMARY KEY DEFAULT ('spn_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"tier" "sponsor_tier" DEFAULT 'community' NOT NULL,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" text PRIMARY KEY DEFAULT ('sa_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"checkpoint_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'booth_staff' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "badge_mints" ADD CONSTRAINT "badge_mints_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_claims" ADD CONSTRAINT "redemption_claims_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_claims" ADD CONSTRAINT "redemption_claims_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badge_mints_player_idx" ON "badge_mints" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "badge_mints_tx_idx" ON "badge_mints" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "checkpoints_event_id_idx" ON "checkpoints" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "checkpoints_route_id_idx" ON "checkpoints" USING btree ("route_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_org_id_idx" ON "events" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "players_event_wallet_idx" ON "players" USING btree ("event_id","wallet");--> statement-breakpoint
CREATE INDEX "players_wallet_idx" ON "players" USING btree ("wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_player_reward_idx" ON "redemption_claims" USING btree ("player_id","reward_id");--> statement-breakpoint
CREATE INDEX "redemption_player_idx" ON "redemption_claims" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "rewards_event_id_idx" ON "rewards" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "routes_event_id_idx" ON "routes" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scans_player_checkpoint_idx" ON "scans" USING btree ("player_id","checkpoint_id");--> statement-breakpoint
CREATE INDEX "scans_checkpoint_idx" ON "scans" USING btree ("checkpoint_id");--> statement-breakpoint
CREATE INDEX "sponsors_event_id_idx" ON "sponsors" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_assignments_unique" ON "staff_assignments" USING btree ("checkpoint_id","user_id");