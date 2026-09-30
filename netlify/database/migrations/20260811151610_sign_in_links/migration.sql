CREATE TABLE "sign_in_links" (
	"email_hash" text PRIMARY KEY,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	"window_started_at" timestamp DEFAULT now() NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL
);
