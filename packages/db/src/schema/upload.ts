import { pgTable, text, timestamp, uuid, bigint } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { folder } from "./folder";
import { user } from "./auth";

export const upload = pgTable("upload", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id")
    .notNull()
    .references(() => folder.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  storageKey: text("storage_key").notNull().unique(),
  status: text("status").$type<"pending" | "completed" | "aborted">().notNull().default("pending"),
  checksum: text("checksum"),
  expiresAt: timestamp("expires_at").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
