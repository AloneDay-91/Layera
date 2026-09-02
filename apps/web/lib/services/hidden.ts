import { db, trashItem, archiveItem, eq, and, notExists, type AnyColumn } from "@filecloud/db";

export async function hiddenItemIds(workspaceId: string) {
  const [trashed, archived] = await Promise.all([
    db.select({ itemId: trashItem.itemId }).from(trashItem).where(eq(trashItem.workspaceId, workspaceId)),
    db.select({ itemId: archiveItem.itemId }).from(archiveItem).where(eq(archiveItem.workspaceId, workspaceId)),
  ]);
  return new Set([...trashed, ...archived].map((row) => row.itemId));
}

export function notInTrash(itemId: AnyColumn, workspaceId: string) {
  return notExists(
    db
      .select({ id: trashItem.id })
      .from(trashItem)
      .where(and(eq(trashItem.itemId, itemId), eq(trashItem.workspaceId, workspaceId))),
  );
}

export function notHidden(itemId: AnyColumn, workspaceId: string) {
  return and(
    notInTrash(itemId, workspaceId),
    notExists(
      db
        .select({ id: archiveItem.id })
        .from(archiveItem)
        .where(and(eq(archiveItem.itemId, itemId), eq(archiveItem.workspaceId, workspaceId))),
    ),
  );
}
