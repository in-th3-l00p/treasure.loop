CREATE TABLE "player_follows" (
	"id" text PRIMARY KEY DEFAULT ('flw_' || lower(translate(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '+/=', '-_'))) NOT NULL,
	"follower_wallet" varchar(42) NOT NULL,
	"following_wallet" varchar(42) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "player_follows_pair_idx" ON "player_follows" USING btree ("follower_wallet","following_wallet");--> statement-breakpoint
CREATE INDEX "player_follows_following_idx" ON "player_follows" USING btree ("following_wallet");