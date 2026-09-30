CREATE TABLE "upload_rates" (
	"member_id" text PRIMARY KEY,
	"window_started_at" timestamp DEFAULT now() NOT NULL,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"upload_bytes" integer DEFAULT 0 NOT NULL
);
