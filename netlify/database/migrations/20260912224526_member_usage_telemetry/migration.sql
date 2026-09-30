CREATE TABLE "member_usage" (
	"member_id" text NOT NULL,
	"day" text NOT NULL,
	"upload_bytes" bigint DEFAULT 0 NOT NULL,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"served_bytes" bigint DEFAULT 0 NOT NULL,
	"served_requests" integer DEFAULT 0 NOT NULL,
	"ai_calls" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "member_usage_member_day_idx" ON "member_usage" ("member_id","day");