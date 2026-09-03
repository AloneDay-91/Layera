ALTER TABLE "instance_settings" ADD COLUMN "github_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "github_client_id" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "github_client_secret" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "google_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "google_client_id" text;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "google_client_secret" text;
