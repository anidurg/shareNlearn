ALTER TABLE "post_field_values" ADD COLUMN "item_type" text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE "post_field_values" ADD COLUMN "item_id" integer;--> statement-breakpoint
ALTER TABLE "post_field_values" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ALTER COLUMN "blob_key" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "post_field_values_item_field_idx" ON "post_field_values" ("item_type","item_id","field_id");