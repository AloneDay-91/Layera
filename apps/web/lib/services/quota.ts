import { db, file, trashItem, eq, and, notInArray, sql } from "@filecloud/db";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024 * 1024);
export const STORAGE_QUOTA_BYTES = Number(process.env.MAX_WORKSPACE_BYTES ?? 10 * 1024 * 1024 * 1024);

export async function workspaceUsedBytes(workspaceId: string): Promise<number> {
  const trashedRows = await db
    .select({ itemId: trashItem.itemId })
    .from(trashItem)
    .where(eq(trashItem.workspaceId, workspaceId));
  const trashedIds = trashedRows.map((row) => row.itemId);

  const [row] = await db
    .select({
      used: sql<number>`coalesce(sum(${file.size}), 0)`,
    })
    .from(file)
    .where(
      trashedIds.length > 0
        ? and(eq(file.workspaceId, workspaceId), notInArray(file.id, trashedIds))
        : eq(file.workspaceId, workspaceId),
    );

  const used = row?.used;
  return typeof used === "number" ? used : Number(used ?? 0);
}
