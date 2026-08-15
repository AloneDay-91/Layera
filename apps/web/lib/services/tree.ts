import { db, folder, file, eq, and } from "@filecloud/db";
import { ServiceError } from "./errors";

export type TreeItem = { id: string; type: "file" | "folder" };

export async function collectDescendantItems(workspaceId: string, folderId: string): Promise<TreeItem[]> {
  const items: TreeItem[] = [];
  const [childFolders, childFiles] = await Promise.all([
    db
      .select({ id: folder.id })
      .from(folder)
      .where(and(eq(folder.workspaceId, workspaceId), eq(folder.parentId, folderId))),
    db
      .select({ id: file.id })
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), eq(file.folderId, folderId))),
  ]);

  for (const child of childFiles) {
    items.push({ id: child.id, type: "file" });
  }
  for (const child of childFolders) {
    items.push({ id: child.id, type: "folder" });
    items.push(...(await collectDescendantItems(workspaceId, child.id)));
  }
  return items;
}

export async function assertFolderMoveAllowed(workspaceId: string, folderId: string, targetFolderId: string) {
  if (folderId === targetFolderId) {
    throw new ServiceError(400, "Cannot move a folder into itself");
  }

  let currentId: string | null = targetFolderId;
  const seen = new Set<string>();
  while (currentId) {
    if (currentId === folderId) {
      throw new ServiceError(400, "Cannot move a folder into one of its descendants");
    }
    if (seen.has(currentId)) {
      throw new ServiceError(400, "Folder cycle detected");
    }
    seen.add(currentId);
    const [row] = await db
      .select({ parentId: folder.parentId })
      .from(folder)
      .where(and(eq(folder.id, currentId), eq(folder.workspaceId, workspaceId)))
      .limit(1);
    currentId = row?.parentId ?? null;
  }
}
