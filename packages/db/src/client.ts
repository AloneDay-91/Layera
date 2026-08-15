import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
});

export const db = drizzle(pool, { schema });
export * from "./schema";
export { provisionPersonalWorkspace, provisionOrganizationWorkspace } from "./provisioning";
export {
  requireWorkspaceAccess,
  requireWorkspaceMember,
  WorkspaceAccessError,
} from "./access";
export type { AuthorizedWorkspace, WorkspaceRow } from "./access";
export type { JobType, JobStatus } from "./schema/job";
export { eq, and, isNull, ilike, inArray, notInArray, gte, lte, sql, desc, ne } from "drizzle-orm";
