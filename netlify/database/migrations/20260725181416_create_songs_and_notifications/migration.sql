CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"song_name" text NOT NULL,
	"composer" text NOT NULL,
	"raga" text NOT NULL,
	"blob_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
