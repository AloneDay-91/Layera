import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";
import { user } from "./auth";

export const trashItem = pgTable("trash_item", {
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
});
