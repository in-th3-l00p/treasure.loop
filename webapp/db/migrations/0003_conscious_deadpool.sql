CREATE TABLE "lead_consents" (
	"id" text PRIMARY KEY DEFAULT ('lc_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"player_id" text NOT NULL,
	"checkpoint_id" text NOT NULL,
	"sponsor_id" text,
	"wallet" varchar(42) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"token" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"sponsor_id" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sponsor_traffic_hourly" (
	"id" text PRIMARY KEY DEFAULT ('sth_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"sponsor_id" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_consents" ADD CONSTRAINT "lead_consents_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_traffic_hourly" ADD CONSTRAINT "sponsor_traffic_hourly_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_traffic_hourly" ADD CONSTRAINT "sponsor_traffic_hourly_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_consents_player_sponsor_idx" ON "lead_consents" USING btree ("player_id","sponsor_id");--> statement-breakpoint
CREATE INDEX "lead_consents_sponsor_idx" ON "lead_consents" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "lead_consents_event_idx" ON "lead_consents" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "share_links_sponsor_idx" ON "share_links" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "share_links_event_idx" ON "share_links" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_traffic_hourly_bucket_idx" ON "sponsor_traffic_hourly" USING btree ("sponsor_id","bucket_start");--> statement-breakpoint
CREATE INDEX "sponsor_traffic_hourly_event_idx" ON "sponsor_traffic_hourly" USING btree ("event_id");