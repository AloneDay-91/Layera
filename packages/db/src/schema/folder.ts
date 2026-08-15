import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const folder = pgTable(
  "folder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folder.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("folder_workspace_parent_name_unique")
      .on(table.workspaceId, table.parentId, table.name)
      .nullsNotDistinct(),
  ],
);
