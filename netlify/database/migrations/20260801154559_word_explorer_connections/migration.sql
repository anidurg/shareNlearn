CREATE TABLE "word_connections" (
	"id" serial PRIMARY KEY,
	"word_id" integer NOT NULL,
	"language" text NOT NULL,
	"term" text NOT NULL,
	"note" text,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "synonyms" text;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "antonyms" text;--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE UNIQUE INDEX "word_connections_word_language_term_idx" ON "word_connections" ("word_id","language","term");