CREATE TABLE "item_photos" (
	"id" serial PRIMARY KEY,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"blob_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "item_photos_item_key_idx" ON "item_photos" ("item_type","item_id","blob_key");