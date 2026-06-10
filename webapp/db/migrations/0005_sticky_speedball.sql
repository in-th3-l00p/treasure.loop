ALTER TABLE "events" ADD COLUMN "rehearsal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "onboarded_at" timestamp with time zone;