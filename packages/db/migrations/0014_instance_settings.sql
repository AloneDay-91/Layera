CREATE TABLE "instance_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"instance_name" text DEFAULT 'Layera' NOT NULL,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"public_sharing_enabled" boolean DEFAULT true NOT NULL,
	"teams_enabled" boolean DEFAULT true NOT NULL,
	"favorites_enabled" boolean DEFAULT true NOT NULL,
	"tags_enabled" boolean DEFAULT true NOT NULL,
	"archive_enabled" boolean DEFAULT true NOT NULL,
	"default_quota_bytes" bigint NOT NULL,
	"max_upload_bytes" bigint NOT NULL,
	"trash_retention_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
INSERT INTO "instance_settings" (
	"id",
	"instance_name",
	"registration_enabled",
	"public_sharing_enabled",
	"teams_enabled",
	"favorites_enabled",
	"tags_enabled",
	"archive_enabled",
	"default_quota_bytes",
	"max_upload_bytes",
	"trash_retention_days"
) VALUES (
	'default',
	'Layera',
	true,
	true,
	true,
	true,
	true,
	true,
	10737418240,
	5368709120,
	30
);
