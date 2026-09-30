CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
