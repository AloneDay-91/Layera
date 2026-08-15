import { pgTable, text, timestamp, uuid, bigint, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { folder } from "./folder";
import { user } from "./auth";

export const file = pgTable(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => folder.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("file_workspace_folder_name_unique").on(table.workspaceId, table.folderId, table.name),
  ],
);
