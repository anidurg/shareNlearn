CREATE TABLE "circle_invites" (
	"id" serial PRIMARY KEY,
	"circle_id" integer NOT NULL,
	"kind" text DEFAULT 'invite' NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"invited_by_id" text NOT NULL,
	"invited_by_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"id" serial PRIMARY KEY,
	"circle_id" integer NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" serial PRIMARY KEY,
	"owner_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT '👥' NOT NULL,
	"cover_key" text,
	"privacy" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_circles" (
	"id" serial PRIMARY KEY,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "circle_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_invites_circle_member_kind_idx" ON "circle_invites" ("circle_id","member_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "circle_members_circle_member_idx" ON "circle_members" ("circle_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_circles_item_circle_idx" ON "item_circles" ("item_type","item_id","circle_id");