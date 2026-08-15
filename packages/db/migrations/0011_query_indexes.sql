CREATE INDEX IF NOT EXISTS "trash_item_workspace_idx" ON "trash_item" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trash_item_item_idx" ON "trash_item" ("item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trash_item_purge_at_idx" ON "trash_item" ("purge_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "share_link_workspace_created_by_idx" ON "share_link" ("workspace_id","created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_workspace_created_at_idx" ON "audit_log" ("workspace_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_created_by_status_idx" ON "upload" ("created_by","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_workspace_updated_at_idx" ON "file" ("workspace_id","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorite_workspace_user_idx" ON "favorite" ("workspace_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_share_shared_with_idx" ON "item_share" ("shared_with_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_share_workspace_item_idx" ON "item_share" ("workspace_id","item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "archive_item_workspace_idx" ON "archive_item" ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "item_tag_workspace_item_idx" ON "item_tag" ("workspace_id","item_id");
