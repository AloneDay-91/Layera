import { pgTable, text, timestamp, uuid, unique, boolean } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const favorite = pgTable(
  "favorite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"file" | "folder">().notNull(),
    itemId: uuid("item_id").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("favorite_user_item_unique").on(table.userId, table.itemId),
  ],
);
