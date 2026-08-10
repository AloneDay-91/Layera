import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";

export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("folder_workspace_parent_name_unique").on(table.workspaceId, table.parentId, table.name),
  ],
);
