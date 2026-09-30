ALTER TABLE "post_translations" ADD COLUMN "engine" text DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "song_lyric_scripts" ADD COLUMN "engine" text DEFAULT 'ai' NOT NULL;