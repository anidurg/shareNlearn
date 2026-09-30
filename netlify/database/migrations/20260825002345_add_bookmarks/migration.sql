CREATE TABLE "bookmarks" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
