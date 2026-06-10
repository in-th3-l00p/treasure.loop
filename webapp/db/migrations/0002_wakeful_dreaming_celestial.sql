CREATE TYPE "public"."staff_alert_status" AS ENUM('open', 'acknowledged');--> statement-breakpoint
CREATE TABLE "staff_alerts" (
	"id" text PRIMARY KEY DEFAULT ('alrt_' || lower(replace(substring(encode(gen_random_bytes(10), 'base64') from 1 for 16), '/', '_'))) NOT NULL,
	"event_id" text NOT NULL,
	"checkpoint_id" text NOT NULL,
	"raised_by" text NOT NULL,
	"kind" text DEFAULT 'help' NOT NULL,
	"message" text,
	"status" "staff_alert_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text
);
--> statement-breakpoint
ALTER TABLE "staff_alerts" ADD CONSTRAINT "staff_alerts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_alerts" ADD CONSTRAINT "staff_alerts_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_alerts_event_status_idx" ON "staff_alerts" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "staff_alerts_checkpoint_idx" ON "staff_alerts" USING btree ("checkpoint_id");