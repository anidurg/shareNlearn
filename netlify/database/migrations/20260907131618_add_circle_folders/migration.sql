CREATE TABLE "folders" (
	"id" serial PRIMARY KEY,
	"circle_id" integer NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_circles" ADD COLUMN "folder_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "folders_circle_name_idx" ON "folders" ("circle_id","parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "folders_circle_root_name_idx" ON "folders" ("circle_id","name") WHERE parent_id is null;