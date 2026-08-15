import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const itemShare = pgTable(
  "item_share",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"file" | "folder">().notNull(),
    itemId: uuid("item_id").notNull(),
    sharedBy: text("shared_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("item_share_item_user_unique").on(table.itemId, table.sharedWithUserId),
    index("item_share_shared_with_idx").on(table.sharedWithUserId),
    index("item_share_workspace_item_idx").on(table.workspaceId, table.itemId),
  ],
);
