CREATE TABLE "blocked_members" (
	"id" serial PRIMARY KEY,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"blocked_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" serial PRIMARY KEY,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"circle_id" integer,
	"reporter_id" text NOT NULL,
	"reporter_name" text NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"reason" text DEFAULT 'other' NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by_id" text,
	"handled_by_name" text,
	"handled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hidden_items" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "admitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "invited_by_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "trusted_at" timestamp;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_members_pair_idx" ON "blocked_members" ("blocker_id","blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_reports_item_reporter_idx" ON "content_reports" ("item_type","item_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hidden_items_member_item_idx" ON "hidden_items" ("member_id","item_type","item_id");--> statement-breakpoint
-- Everyone already in the group was let in before there was a gate, so the gate
-- opens for them: admitting them here is what keeps this change from locking the
-- existing members out of their own app.
INSERT INTO "members" ("id", "name", "admitted_at", "created_at", "last_seen_at")
SELECT "member_id", MIN("member_name"), now(), now(), now()
FROM "circle_members"
WHERE NOT EXISTS (SELECT 1 FROM "members" WHERE "members"."id" = "circle_members"."member_id")
GROUP BY "member_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "members" SET "admitted_at" = "created_at" WHERE "admitted_at" IS NULL;--> statement-breakpoint
-- Anybody already running a circle has plainly earned the right to start one.
UPDATE "members" SET "trusted_at" = now()
WHERE "trusted_at" IS NULL AND "id" IN (SELECT "owner_id" FROM "circles");--> statement-breakpoint
-- Somebody has to be able to answer an abuse report on the day this ships, so the
-- longest-standing account becomes the global admin. Any Identity user carrying
-- the "admin" role counts as one too, which is how that can be changed later.
UPDATE "members" SET "role" = 'app_admin'
WHERE "id" = (SELECT "id" FROM "members" ORDER BY "created_at" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "members" WHERE "role" = 'app_admin');