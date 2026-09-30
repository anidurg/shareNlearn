CREATE TABLE "post_translations" (
	"id" serial PRIMARY KEY,
	"post_id" integer NOT NULL,
	"language" text NOT NULL,
	"body" text NOT NULL,
	"source_digest" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "translate_into" text;--> statement-breakpoint
CREATE UNIQUE INDEX "post_translations_post_language_idx" ON "post_translations" ("post_id","language");