CREATE TABLE "item_shares" (
	"id" serial PRIMARY KEY,
	"token" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"circle_id" integer,
	"shared_by_id" text NOT NULL,
	"shared_by_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "item_shares_token_idx" ON "item_shares" ("token");