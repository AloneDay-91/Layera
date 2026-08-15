import { db, file, folder, eq, and } from "@filecloud/db";
import { removeStoredObjects, removeStoredPrefix } from "@filecloud/storage";

export async function collectFolderStorageKeys(workspaceId: string, folderId: string): Promise<string[]> {
  const keys: string[] = [];
  const childFiles = await db
    .select({ storageKey: file.storageKey, thumbnailKey: file.thumbnailKey })
    .from(file)
    .where(and(eq(file.workspaceId, workspaceId), eq(file.folderId, folderId)));
  keys.push(...childFiles.flatMap((row) => (row.thumbnailKey ? [row.storageKey, row.thumbnailKey] : [row.storageKey])));

  const childFolders = await db
    .select({ id: folder.id })
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.parentId, folderId)));
  for (const child of childFolders) {
    keys.push(...(await collectFolderStorageKeys(workspaceId, child.id)));
  }
  return keys;
}

export async function collectItemStorageKeys(
  workspaceId: string,
  input: { id: string; type: "file" | "folder" },
): Promise<string[]> {
  if (input.type === "file") {
    const [row] = await db
      .select({ storageKey: file.storageKey, thumbnailKey: file.thumbnailKey })
      .from(file)
      .where(and(eq(file.id, input.id), eq(file.workspaceId, workspaceId)))
      .limit(1);
    if (!row) return [];
    return row.thumbnailKey ? [row.storageKey, row.thumbnailKey] : [row.storageKey];
  }
  return collectFolderStorageKeys(workspaceId, input.id);
}

export async function deleteStoredFiles(storageKeys: string[]) {
  await removeStoredObjects(storageKeys);
}

export async function deleteWorkspaceStoredFiles(workspaceId: string) {
  await removeStoredPrefix(`workspaces/${workspaceId}/`);
}
