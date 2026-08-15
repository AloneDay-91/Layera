import { db, user, inArray, sql, eq } from "@filecloud/db";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

export async function usersByIds(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map<string, PublicUser>();
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`)
    .limit(1);
  return row ?? null;
}

export async function getUserById(id: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}
