import { pgTable, text, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";
import type { WorkspaceRole, WorkspaceType } from "@filecloud/types";
import { user, organization } from "./auth";

export const workspace = pgTable(
  "workspace",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    type: text("type").$type<WorkspaceType>().notNull().default("personal"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("workspace_organization_id_idx").on(table.organizationId),
    index("workspace_personal_owner_idx").on(table.ownerId),
  ],
);

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique("workspace_member_workspace_user_unique").on(table.workspaceId, table.userId)],
);
