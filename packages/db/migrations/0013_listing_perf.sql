CREATE INDEX IF NOT EXISTS "workspace_organization_id_idx" ON "workspace" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_personal_owner_idx" ON "workspace" ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trash_item_workspace_item_idx" ON "trash_item" ("workspace_id","item_id");
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folder_name_trgm_idx" ON "folder" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_name_trgm_idx" ON "file" USING gin ("name" gin_trgm_ops);
