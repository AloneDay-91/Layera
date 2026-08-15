import { db, trashItem, archiveItem, eq } from "@filecloud/db";

export async function hiddenItemIds(workspaceId: string) {
  const [trashed, archived] = await Promise.all([
    db.select({ itemId: trashItem.itemId }).from(trashItem).where(eq(trashItem.workspaceId, workspaceId)),
    db.select({ itemId: archiveItem.itemId }).from(archiveItem).where(eq(archiveItem.workspaceId, workspaceId)),
  ]);
  return new Set([...trashed, ...archived].map((row) => row.itemId));
}
