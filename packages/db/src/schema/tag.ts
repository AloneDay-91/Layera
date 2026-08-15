import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import { workspace } from "./workspace";

export const TAG_COLORS = ["neutral", "red", "orange", "green", "teal", "blue", "purple", "info"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").$type<TagColor>().notNull().default("neutral"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("tag_workspace_name_unique").on(table.workspaceId, table.name)],
);

export const itemTag = pgTable(
  "item_tag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
    itemType: text("item_type").$type<"file" | "folder">().notNull(),
    itemId: uuid("item_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("item_tag_tag_item_unique").on(table.tagId, table.itemId),
    index("item_tag_workspace_item_idx").on(table.workspaceId, table.itemId),
  ],
);
