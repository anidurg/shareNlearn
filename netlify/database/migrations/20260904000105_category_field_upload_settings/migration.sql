ALTER TABLE "category_fields" ADD COLUMN "file_types" text;--> statement-breakpoint
ALTER TABLE "category_fields" ADD COLUMN "max_bytes" integer;--> statement-breakpoint
ALTER TABLE "category_fields" ADD COLUMN "multiple" boolean DEFAULT false NOT NULL;