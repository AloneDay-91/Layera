import { db, upload, trashItem, file, folder, favorite, eq, and, lte } from "@filecloud/db";
import { removeStoredObject, removeStoredObjects } from "@filecloud/storage";

async function collectFolderStorageKeys(workspaceId: string, folderId: string): Promise<string[]> {
  const keys: string[] = [];
  const childFiles = await db
    .select({ storageKey: file.storageKey, thumbnailKey: file.thumbnailKey })
    .from(file)
    .where(and(eq(file.workspaceId, workspaceId), eq(file.folderId, folderId)));
  for (const row of childFiles) {
    keys.push(row.storageKey);
    if (row.thumbnailKey) keys.push(row.thumbnailKey);
  }

  const childFolders = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.parentId, folderId)));
  for (const child of childFolders) {
    keys.push(...(await collectFolderStorageKeys(workspaceId, child.id)));
  }
  return keys;
}

export async function abortExpiredUploads() {
  const expired = await db
    .select()
    .from(upload)
    .where(and(eq(upload.status, "pending"), lte(upload.expiresAt, new Date())));

  for (const row of expired) {
    await removeStoredObject(row.storageKey);
    await db.update(upload).set({ status: "aborted" }).where(eq(upload.id, row.id));
  }

  return expired.length;
}

export async function purgeExpiredTrash() {
  const expired = await db.select().from(trashItem).where(lte(trashItem.purgeAt, new Date()));

  for (const row of expired) {
    const keys =
      row.itemType === "file"
        ? await (async () => {
            const [fileRow] = await db
              .select({ storageKey: file.storageKey, thumbnailKey: file.thumbnailKey })
              .from(file)
              .where(and(eq(file.id, row.itemId), eq(file.workspaceId, row.workspaceId)))
              .limit(1);
            return fileRow
              ? [fileRow.storageKey, ...(fileRow.thumbnailKey ? [fileRow.thumbnailKey] : [])]
              : [];
          })()
        : await collectFolderStorageKeys(row.workspaceId, row.itemId);

    await removeStoredObjects(keys);
    if (row.itemType === "file") {
      await db.delete(file).where(and(eq(file.id, row.itemId), eq(file.workspaceId, row.workspaceId)));
    } else {
      await db.delete(folder).where(and(eq(folder.id, row.itemId), eq(folder.workspaceId, row.workspaceId)));
    }
    await db.delete(favorite).where(and(eq(favorite.itemId, row.itemId), eq(favorite.workspaceId, row.workspaceId)));
    await db.delete(trashItem).where(eq(trashItem.id, row.id));
  }

  return expired.length;
}
