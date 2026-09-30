CREATE TABLE "remedies" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"title" text NOT NULL,
	"used_for" text NOT NULL,
	"ingredients" text NOT NULL,
	"preparation" text NOT NULL,
	"how_to_use" text,
	"passed_down_from" text,
	"notes" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
