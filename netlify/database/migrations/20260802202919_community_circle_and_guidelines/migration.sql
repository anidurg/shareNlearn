ALTER TABLE "circles" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "guidelines_accepted_at" timestamp;