import { db, folder, file, archiveItem, trashItem, favorite, eq, and, inArray } from "@filecloud/db";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { getFileInWorkspace, getFolderInWorkspace } from "./files";
import { recordAudit } from "./audit";
import { usersByIds } from "./users";
import { collectItemStorageKeys, deleteStoredFiles } from "./storage-cleanup";
import { collectDescendantItems } from "./tree";
import { assertOwner } from "./permissions";

export async function listArchivedItems(ctx: AuthorizedContext) {
  const rows = await db.select().from(archiveItem).where(eq(archiveItem.workspaceId, ctx.workspace.id));
  const owners = await usersByIds(rows.map((row) => row.archivedBy));
  const fileIds = rows.filter((row) => row.itemType === "file").map((row) => row.itemId);
  const folderIds = rows.filter((row) => row.itemType === "folder").map((row) => row.itemId);
  const [files, folders] = await Promise.all([
    fileIds.length > 0 ? db.select().from(file).where(inArray(file.id, fileIds)) : Promise.resolve([]),
    folderIds.length > 0 ? db.select().from(folder).where(inArray(folder.id, folderIds)) : Promise.resolve([]),
  ]);
  const fileById = new Map(files.map((row) => [row.id, row]));
  const folderById = new Map(folders.map((row) => [row.id, row]));
  const result = [];

  for (const row of rows) {
    if (row.itemType === "file") {
      const fRecord = fileById.get(row.itemId);
      if (fRecord && fRecord.workspaceId === ctx.workspace.id) {
        result.push({
          id: fRecord.id,
          archiveId: row.id,
          type: "file" as const,
          name: fRecord.name,
          size: fRecord.size,
          mimeType: fRecord.mimeType,
          archivedAt: row.archivedAt.toISOString(),
          owner: owners.get(row.archivedBy)?.name ?? ctx.actor.name,
          ownerId: row.archivedBy,
        });
      }
    } else {
      const fldRecord = folderById.get(row.itemId);
      if (fldRecord && fldRecord.workspaceId === ctx.workspace.id) {
        result.push({
          id: fldRecord.id,
          archiveId: row.id,
          type: "folder" as const,
          name: fldRecord.name,
          size: null,
          mimeType: null,
          archivedAt: row.archivedAt.toISOString(),
          owner: owners.get(row.archivedBy)?.name ?? ctx.actor.name,
          ownerId: row.archivedBy,
        });
      }
    }
  }

  return result.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
}

export async function archiveItemInWorkspace(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  if (input.type === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
  }

  const toArchive: Array<{ id: string; type: "file" | "folder" }> = [input];
  if (input.type === "folder") {
    toArchive.push(...(await collectDescendantItems(ctx.workspace.id, input.id)));
  }

  const existing = await db
    .select({ itemId: archiveItem.itemId })
    .from(archiveItem)
    .where(eq(archiveItem.workspaceId, ctx.workspace.id));
  const alreadyArchived = new Set(existing.map((row) => row.itemId));
  const fresh = toArchive.filter((item) => !alreadyArchived.has(item.id));
  const ids = fresh.map((item) => item.id);
  if (ids.length > 0) {
    await db.delete(trashItem).where(and(eq(trashItem.workspaceId, ctx.workspace.id), inArray(trashItem.itemId, ids)));
    await db.insert(archiveItem).values(
      fresh.map((item) => ({
        workspaceId: ctx.workspace.id,
        itemType: item.type,
        itemId: item.id,
        archivedBy: ctx.actor.id,
      })),
    );
  }
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.archive" : "folder.archive",
    targetType: input.type,
    targetId: input.id,
  });
}

export async function restoreArchivedItem(ctx: AuthorizedContext, input: { id: string; type: "file" | "folder" }) {
  const [row] = await db
    .select()
    .from(archiveItem)
    .where(and(eq(archiveItem.itemId, input.id), eq(archiveItem.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Item not found");
  // The archive row decides, not the caller: a mismatched type would leave the
  // children archived behind a restored parent.
  const itemType = row.itemType;
  const ids = [input.id];
  if (itemType === "folder") {
    ids.push(...(await collectDescendantItems(ctx.workspace.id, input.id)).map((item) => item.id));
  }
  await db.delete(archiveItem).where(and(eq(archiveItem.workspaceId, ctx.workspace.id), inArray(archiveItem.itemId, ids)));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: itemType === "file" ? "file.unarchive" : "folder.unarchive",
    targetType: itemType,
    targetId: input.id,
  });
}

export async function permanentlyDeleteArchivedItem(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  assertOwner(ctx);
  const [row] = await db
    .select()
    .from(archiveItem)
    .where(and(eq(archiveItem.itemId, input.id), eq(archiveItem.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Item not found");

  const itemType = row.itemType;
  const storageKeys = await collectItemStorageKeys(ctx.workspace.id, { id: input.id, type: itemType });
  await deleteStoredFiles(storageKeys);

  if (itemType === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
    await db.delete(file).where(and(eq(file.id, input.id), eq(file.workspaceId, ctx.workspace.id)));
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
    await db.delete(folder).where(and(eq(folder.id, input.id), eq(folder.workspaceId, ctx.workspace.id)));
  }
  await db.delete(favorite).where(and(eq(favorite.itemId, input.id), eq(favorite.workspaceId, ctx.workspace.id)));
  await db.delete(archiveItem).where(eq(archiveItem.id, row.id));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: itemType === "file" ? "file.delete" : "folder.delete",
    targetType: itemType,
    targetId: input.id,
  });
}
