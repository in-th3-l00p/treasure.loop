CREATE TYPE "public"."event_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "visibility" "event_visibility" DEFAULT 'unlisted' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_image_url" varchar(2048);