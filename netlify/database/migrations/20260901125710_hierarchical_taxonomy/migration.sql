ALTER TABLE "circles" ADD COLUMN "member_taxonomy" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subcategories" ADD COLUMN "parent_id" integer;--> statement-breakpoint
DROP INDEX "subcategories_category_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_name_idx" ON "subcategories" ("category_id","parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_root_name_idx" ON "subcategories" ("category_id","name") WHERE parent_id is null;