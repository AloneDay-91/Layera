import { pgTable, text, timestamp, uuid, jsonb, integer, index } from "drizzle-orm/pg-core";

export type JobType = "thumbnail" | "purge-trash" | "abort-uploads";
export type JobStatus = "pending" | "running" | "completed" | "failed";

export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<JobType>().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    runAfter: timestamp("run_after").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("job_status_run_after_idx").on(table.status, table.runAfter),
    index("job_type_status_idx").on(table.type, table.status),
  ],
);
