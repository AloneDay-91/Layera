CREATE TABLE "archive_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"archived_by" text NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "archive_item_item_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "item_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" uuid NOT NULL,
	"shared_by" text NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_share_item_user_unique" UNIQUE("item_id","shared_with_user_id")
);
--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "favorite" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "favorite" ADD COLUMN "pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "archive_item" ADD CONSTRAINT "archive_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_item" ADD CONSTRAINT "archive_item_archived_by_user_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_share" ADD CONSTRAINT "item_share_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_share" ADD CONSTRAINT "item_share_shared_by_user_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_share" ADD CONSTRAINT "item_share_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "file" SET "created_by" = "workspace"."owner_id" FROM "workspace" WHERE "workspace"."id" = "file"."workspace_id" AND "file"."created_by" IS NULL;--> statement-breakpoint
UPDATE "folder" SET "created_by" = "workspace"."owner_id" FROM "workspace" WHERE "workspace"."id" = "folder"."workspace_id" AND "folder"."created_by" IS NULL AND "folder"."name" <> 'root';