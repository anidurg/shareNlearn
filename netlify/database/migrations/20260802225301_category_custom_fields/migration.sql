CREATE TABLE "category_fields" (
	"id" serial PRIMARY KEY,
	"category_id" integer NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"options" text,
	"hint" text,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_field_values" (
	"id" serial PRIMARY KEY,
	"post_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "category_fields_category_label_idx" ON "category_fields" ("category_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "post_field_values_post_field_idx" ON "post_field_values" ("post_id","field_id");