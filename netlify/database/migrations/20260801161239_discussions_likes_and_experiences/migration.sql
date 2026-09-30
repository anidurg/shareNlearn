CREATE TABLE "book_discussions" (
	"id" serial PRIMARY KEY,
	"book_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"summary" text,
	"summary_reply_count" integer,
	"summary_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_replies" (
	"id" serial PRIMARY KEY,
	"discussion_id" integer NOT NULL,
	"body" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_experiences" (
	"id" serial PRIMARY KEY,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"kind" text DEFAULT 'experience' NOT NULL,
	"body" text NOT NULL,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_likes" (
	"id" serial PRIMARY KEY,
	"item_type" text NOT NULL,
	"item_id" integer NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "item_likes_item_member_idx" ON "item_likes" ("item_type","item_id","member_id");