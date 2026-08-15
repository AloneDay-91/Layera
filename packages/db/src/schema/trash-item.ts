import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const trashItem = pgTable(
  "trash_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"file" | "folder">().notNull(),
    itemId: uuid("item_id").notNull(),
    deletedBy: text("deleted_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    deletedAt: timestamp("deleted_at").notNull().defaultNow(),
    purgeAt: timestamp("purge_at").notNull(),
  },
  (table) => [
    index("trash_item_workspace_idx").on(table.workspaceId),
    index("trash_item_item_idx").on(table.itemId),
    index("trash_item_purge_at_idx").on(table.purgeAt),
  ],
);
