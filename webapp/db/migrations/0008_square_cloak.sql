CREATE TYPE "public"."rsvp_status" AS ENUM('going', 'interested');--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"id" text PRIMARY KEY DEFAULT ('rsvp_' || lower(translate(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '+/=', '-_'))) NOT NULL,
	"event_id" text NOT NULL,
	"wallet" varchar(42) NOT NULL,
	"status" "rsvp_status" DEFAULT 'going' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"wallet" varchar(42) PRIMARY KEY NOT NULL,
	"handle" varchar(32),
	"display_name" varchar(64),
	"avatar_url" varchar(2048),
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvps_event_wallet_idx" ON "event_rsvps" USING btree ("event_id","wallet");--> statement-breakpoint
CREATE INDEX "event_rsvps_wallet_idx" ON "event_rsvps" USING btree ("wallet");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_handle_idx" ON "player_profiles" USING btree ("handle");