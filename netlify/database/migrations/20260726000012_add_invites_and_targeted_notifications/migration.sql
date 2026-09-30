CREATE TABLE "invites" (
	"id" serial PRIMARY KEY,
	"token" text NOT NULL,
	"inviter_id" text NOT NULL,
	"inviter_name" text NOT NULL,
	"invitee_name" text,
	"invitee_email" text,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_member_id" text,
	"accepted_member_name" text,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "link" text;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_idx" ON "invites" ("token");