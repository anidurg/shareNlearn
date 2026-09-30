CREATE TABLE "song_lyric_scripts" (
	"id" serial PRIMARY KEY,
	"song_id" integer NOT NULL,
	"script" text NOT NULL,
	"body" text NOT NULL,
	"source_digest" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_discussions" ADD COLUMN "item_type" text;--> statement-breakpoint
ALTER TABLE "book_discussions" ADD COLUMN "item_id" integer;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "lyrics" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "lyrics_language" text;--> statement-breakpoint
ALTER TABLE "book_discussions" ALTER COLUMN "book_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "song_lyric_scripts_song_script_idx" ON "song_lyric_scripts" ("song_id","script");