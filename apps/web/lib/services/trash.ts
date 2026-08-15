import {
  db,
  folder,
  file,
  trashItem,
  favorite,
  eq,
  and,
} from "@filecloud/db";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { getFileInWorkspace, getFolderInWorkspace } from "./files";
import { recordAudit } from "./audit";
import { collectItemStorageKeys, deleteStoredFiles } from "./storage-cleanup";

export async function listTrashedItems(ctx: AuthorizedContext) {
  const trashedRows = await db.select().from(trashItem).where(eq(trashItem.workspaceId, ctx.workspace.id));
  const resultItems = [];

  for (const tRow of trashedRows) {
    if (tRow.itemType === "file") {
      const [fRecord] = await db.select().from(file).where(eq(file.id, tRow.itemId)).limit(1);
      if (fRecord && fRecord.workspaceId === ctx.workspace.id) {
        resultItems.push({
          id: fRecord.id,
          trashId: tRow.id,
          type: "file" as const,
          name: fRecord.name,
          size: fRecord.size,
          mimeType: fRecord.mimeType,
          deletedAt: tRow.deletedAt.toISOString(),
          purgeAt: tRow.purgeAt.toISOString(),
          owner: ctx.actor.name,
        });
      }
    } else {
      const [fldRecord] = await db.select().from(folder).where(eq(folder.id, tRow.itemId)).limit(1);
      if (fldRecord && fldRecord.workspaceId === ctx.workspace.id) {
        resultItems.push({
          id: fldRecord.id,
          trashId: tRow.id,
          type: "folder" as const,
          name: fldRecord.name,
          size: null,
          mimeType: null,
          deletedAt: tRow.deletedAt.toISOString(),
          purgeAt: tRow.purgeAt.toISOString(),
          owner: ctx.actor.name,
        });
      }
    }
  }

  return resultItems;
}

export async function restoreTrashedItem(ctx: AuthorizedContext, input: { id: string; type: "file" | "folder" }) {
  const [row] = await db
    .select()
    .from(trashItem)
    .where(and(eq(trashItem.itemId, input.id), eq(trashItem.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Item not found");
  await db.delete(trashItem).where(eq(trashItem.id, row.id));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.restore" : "folder.restore",
    targetType: input.type,
    targetId: input.id,
  });
}

export async function emptyTrash(ctx: AuthorizedContext) {
  const trashedRows = await db.select().from(trashItem).where(eq(trashItem.workspaceId, ctx.workspace.id));
  const storageKeys: string[] = [];
  for (const tRow of trashedRows) {
    storageKeys.push(
      ...(await collectItemStorageKeys(ctx.workspace.id, { id: tRow.itemId, type: tRow.itemType })),
    );
  }
  await deleteStoredFiles(storageKeys);

  for (const tRow of trashedRows) {
    if (tRow.itemType === "file") {
      await db.delete(file).where(and(eq(file.id, tRow.itemId), eq(file.workspaceId, ctx.workspace.id)));
    } else {
      await db.delete(folder).where(and(eq(folder.id, tRow.itemId), eq(folder.workspaceId, ctx.workspace.id)));
    }
    await db.delete(favorite).where(and(eq(favorite.itemId, tRow.itemId), eq(favorite.workspaceId, ctx.workspace.id)));
  }
  await db.delete(trashItem).where(eq(trashItem.workspaceId, ctx.workspace.id));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "file.delete",
    targetType: "folder",
    metadata: { emptied: true, count: trashedRows.length },
  });
}

export async function permanentlyDeleteTrashedItem(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  const [row] = await db
    .select()
    .from(trashItem)
    .where(and(eq(trashItem.itemId, input.id), eq(trashItem.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Item not found");

  const storageKeys = await collectItemStorageKeys(ctx.workspace.id, input);
  await deleteStoredFiles(storageKeys);

  if (input.type === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
    await db.delete(file).where(and(eq(file.id, input.id), eq(file.workspaceId, ctx.workspace.id)));
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
    await db.delete(folder).where(and(eq(folder.id, input.id), eq(folder.workspaceId, ctx.workspace.id)));
  }
  await db.delete(favorite).where(and(eq(favorite.itemId, input.id), eq(favorite.workspaceId, ctx.workspace.id)));
  await db.delete(trashItem).where(eq(trashItem.id, row.id));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.delete" : "folder.delete",
    targetType: input.type,
    targetId: input.id,
  });
}
