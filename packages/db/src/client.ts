import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });
export * from "./schema";
export { provisionPersonalWorkspace, provisionOrganizationWorkspace } from "./provisioning";
export { eq, and, isNull, ilike, inArray, notInArray, gte, lte, sql, desc } from "drizzle-orm";
