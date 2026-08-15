import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { file } from "./file";
import { folder } from "./folder";
import { workspace } from "./workspace";

export const shareLink = pgTable(
  "share_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => file.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folder.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("share_link_workspace_created_by_idx").on(table.workspaceId, table.createdBy)],
);
