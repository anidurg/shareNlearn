CREATE TABLE "books" (
	"id" serial PRIMARY KEY,
	"member_id" text NOT NULL,
	"member_name" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"genre" text,
	"rating" integer,
	"review" text,
	"quote" text,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
