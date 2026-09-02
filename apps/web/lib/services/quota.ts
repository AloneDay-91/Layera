import { db, file, folder, trashItem, eq, and, sql, ne, exists } from "@filecloud/db";
import { notInTrash } from "./hidden";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024 * 1024);
export const STORAGE_QUOTA_BYTES = Number(process.env.MAX_WORKSPACE_BYTES ?? 10 * 1024 * 1024 * 1024);

type Category = "images" | "documents" | "videos" | "other";

const CATEGORY_SQL = sql<string>`
  CASE
    WHEN ${file.mimeType} LIKE 'image/%' THEN 'images'
    WHEN ${file.mimeType} LIKE 'video/%' THEN 'videos'
    WHEN ${file.mimeType} = 'application/pdf'
      OR ${file.mimeType} LIKE 'text/%'
      OR ${file.mimeType} LIKE '%word%'
      OR ${file.mimeType} LIKE '%spreadsheet%'
      OR ${file.mimeType} LIKE '%presentation%'
    THEN 'documents'
    ELSE 'other'
  END
`;

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

export async function workspaceUsedBytes(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({
      used: sql<number>`coalesce(sum(${file.size}), 0)`,
    })
    .from(file)
    .where(and(eq(file.workspaceId, workspaceId), notInTrash(file.id, workspaceId)));
  return asNumber(row?.used);
}

export async function workspaceStorageStats(workspaceId: string) {
  const fileInTrash = exists(
    db
      .select({ id: trashItem.id })
      .from(trashItem)
      .where(and(eq(trashItem.itemId, file.id), eq(trashItem.workspaceId, workspaceId))),
  );

  const [usedRow, trashRow, folderRow, categoryRows] = await Promise.all([
    db
      .select({
        used: sql<number>`coalesce(sum(${file.size}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), notInTrash(file.id, workspaceId))),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${file.size}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), fileInTrash)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(folder)
      .where(
        and(eq(folder.workspaceId, workspaceId), ne(folder.name, "root"), notInTrash(folder.id, workspaceId)),
      ),
    db
      .select({
        category: CATEGORY_SQL.as("category"),
        bytes: sql<number>`coalesce(sum(${file.size}), 0)`,
      })
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), notInTrash(file.id, workspaceId)))
      .groupBy(CATEGORY_SQL),
  ]);

  const categories: Record<Category, number> = { images: 0, documents: 0, videos: 0, other: 0 };
  for (const row of categoryRows) {
    const category = row.category;
    if (category === "images" || category === "documents" || category === "videos" || category === "other") {
      categories[category] = asNumber(row.bytes);
    }
  }

  return {
    usedBytes: asNumber(usedRow[0]?.used),
    fileCount: asNumber(usedRow[0]?.count),
    folderCount: asNumber(folderRow[0]?.count),
    trashBytes: asNumber(trashRow[0]?.bytes),
    trashCount: asNumber(trashRow[0]?.count),
    categories,
  };
}
