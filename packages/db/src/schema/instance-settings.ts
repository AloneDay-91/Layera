import { pgTable, text, timestamp, boolean, integer, bigint } from "drizzle-orm/pg-core";

export const INSTANCE_SETTINGS_ID = "default";

export const instanceSettings = pgTable("instance_settings", {
  id: text("id").primaryKey().default(INSTANCE_SETTINGS_ID),
  instanceName: text("instance_name").notNull().default("Layera"),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  publicSharingEnabled: boolean("public_sharing_enabled").notNull().default(true),
  teamsEnabled: boolean("teams_enabled").notNull().default(true),
  favoritesEnabled: boolean("favorites_enabled").notNull().default(true),
  tagsEnabled: boolean("tags_enabled").notNull().default(true),
  archiveEnabled: boolean("archive_enabled").notNull().default(true),
  defaultQuotaBytes: bigint("default_quota_bytes", { mode: "number" }).notNull(),
  maxUploadBytes: bigint("max_upload_bytes", { mode: "number" }).notNull(),
  trashRetentionDays: integer("trash_retention_days").notNull().default(30),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
