import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const archiveItem = pgTable(
  "archive_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"file" | "folder">().notNull(),
    itemId: uuid("item_id").notNull(),
    archivedBy: text("archived_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at").notNull().defaultNow(),
  },
  (table) => [
    unique("archive_item_item_unique").on(table.itemId),
    index("archive_item_workspace_idx").on(table.workspaceId),
  ],
);
