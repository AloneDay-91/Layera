import { db, folder, file, eq, and } from "@filecloud/db";

export function nextAvailableName(baseName: string, taken: Set<string>, kind: "file" | "folder") {
  if (!taken.has(baseName)) return baseName;
  if (kind === "folder") {
    let n = 2;
    while (taken.has(`${baseName} (${n})`)) n++;
    return `${baseName} (${n})`;
  }
  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : "";
  let n = 2;
  while (taken.has(`${stem} (${n})${ext}`)) n++;
  return `${stem} (${n})${ext}`;
}

export async function uniqueFolderName(
  workspaceId: string,
  parentId: string,
  baseName: string,
  excludeId?: string,
) {
  const siblings = await db
    .select({ id: folder.id, name: folder.name })
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.parentId, parentId)));
  const taken = new Set(siblings.filter((s) => s.id !== excludeId).map((s) => s.name));
  return nextAvailableName(baseName, taken, "folder");
}

export async function uniqueFileName(
  workspaceId: string,
  folderId: string,
  baseName: string,
  excludeId?: string,
) {
  const siblings = await db
    .select({ id: file.id, name: file.name })
    .from(file)
    .where(and(eq(file.workspaceId, workspaceId), eq(file.folderId, folderId)));
  const taken = new Set(siblings.filter((s) => s.id !== excludeId).map((s) => s.name));
  return nextAvailableName(baseName, taken, "file");
}

export async function folderNameTaken(
  workspaceId: string,
  parentId: string,
  name: string,
  excludeId?: string,
) {
  const siblings = await db
    .select({ id: folder.id, name: folder.name })
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), eq(folder.parentId, parentId)));
  return siblings.some((s) => s.name === name && s.id !== excludeId);
}

export async function fileNameTaken(
  workspaceId: string,
  folderId: string,
  name: string,
  excludeId?: string,
) {
  const siblings = await db
    .select({ id: file.id, name: file.name })
    .from(file)
    .where(and(eq(file.workspaceId, workspaceId), eq(file.folderId, folderId)));
  return siblings.some((s) => s.name === name && s.id !== excludeId);
}
