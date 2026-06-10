CREATE TYPE "public"."fragment_kind" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "fragments" (
	"id" text PRIMARY KEY DEFAULT ('frg_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"player_id" text NOT NULL,
	"checkpoint_id" text NOT NULL,
	"fragment_kind" "fragment_kind" NOT NULL,
	"short_code" varchar(5) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paired_with_player_id" text,
	"paired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fragments" ADD CONSTRAINT "fragments_paired_with_player_id_players_id_fk" FOREIGN KEY ("paired_with_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fragments_player_checkpoint_idx" ON "fragments" USING btree ("player_id","checkpoint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fragments_event_checkpoint_code_idx" ON "fragments" USING btree ("event_id","checkpoint_id","short_code");--> statement-breakpoint
CREATE INDEX "fragments_checkpoint_kind_idx" ON "fragments" USING btree ("checkpoint_id","fragment_kind");