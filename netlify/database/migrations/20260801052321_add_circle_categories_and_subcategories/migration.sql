CREATE TABLE "circle_categories" (
	"id" serial PRIMARY KEY,
	"circle_id" integer NOT NULL,
	"item_type" text,
	"name" text NOT NULL,
	"icon" text DEFAULT '📌' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"category_id" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"happens_on" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_circles" ADD COLUMN "subcategory_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_categories_circle_type_idx" ON "circle_categories" ("circle_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_name_idx" ON "subcategories" ("category_id","name");