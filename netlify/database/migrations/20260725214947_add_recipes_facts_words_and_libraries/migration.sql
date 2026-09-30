CREATE TABLE "facts" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"fact" text NOT NULL,
	"category" text DEFAULT 'Other' NOT NULL,
	"source" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learned_words" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"word_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"title" text NOT NULL,
	"ingredients" text NOT NULL,
	"method" text NOT NULL,
	"notes" text,
	"prep_minutes" integer,
	"category" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"word" text NOT NULL,
	"meaning" text NOT NULL,
	"example" text,
	"language" text,
	"pronunciation" text,
	"source" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "item_type" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "visibility" text DEFAULT 'shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ALTER COLUMN "composer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ALTER COLUMN "raga" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "learned_words_member_word_idx" ON "learned_words" ("member_id","word_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_member_item_idx" ON "saved_items" ("member_id","item_type","item_id");