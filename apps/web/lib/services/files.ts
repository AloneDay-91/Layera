import {
  db,
  folder,
  file,
  trashItem,
  favorite,
  tag,
  itemTag,
  archiveItem,
  itemShare,
  eq,
  and,
  isNull,
  ilike,
  inArray,
  requireWorkspaceMember,
} from "@filecloud/db";
import { copyStoredObject, ensureBucket, objectStorageKey, putStoredObject } from "@filecloud/storage";
import { randomUUID } from "crypto";
import { FOLDER_COLOR_OPTIONS } from "@/lib/folder-colors";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { recordAudit } from "./audit";
import {
  assertSafeItemName,
  uniqueFolderName,
  uniqueFileName,
  folderNameTaken,
  fileNameTaken,
} from "./names";
import { hiddenItemIds, notHidden } from "./hidden";
import { getTrashRetentionDays } from "./instance-settings";
import { usersByIds } from "./users";
import { collectItemStorageKeys, deleteStoredFiles } from "./storage-cleanup";
import { assertFolderMoveAllowed, collectDescendantItems, folderBreadcrumbs } from "./tree";
import { assertOwner } from "./permissions";
import { previewUrlsByFileId } from "./signed-read";

const FOLDER_COLOR_VALUES = new Set<string>(FOLDER_COLOR_OPTIONS.map((opt) => opt.value));

export type ListedItem = {
  id: string;
  parentId: string | null;
  type: "file" | "folder";
  name: string;
  mimeType: string | null;
  size: number | null;
  updatedAt: string;
  owner: string;
  ownerId: string | null;
  isFavorite: boolean;
  tags: { id: string; name: string; color: string }[];
  color?: string | null;
  hasThumbnail?: boolean;
  thumbnailUrl?: string;
};

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function getRootFolder(workspaceId: string) {
  const [root] = await db
    .select()
    .from(folder)
    .where(and(eq(folder.workspaceId, workspaceId), isNull(folder.parentId)))
    .limit(1);
  return root ?? null;
}

export async function resolveFolderInWorkspace(workspaceId: string, folderId: string | null | undefined) {
  if (!folderId) {
    const root = await getRootFolder(workspaceId);
    if (!root) throw new ServiceError(400, "Target folder not found");
    return root;
  }
  const [row] = await db
    .select()
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Folder not found");
  return row;
}

export async function getFileInWorkspace(workspaceId: string, fileId: string) {
  const [row] = await db
    .select()
    .from(file)
    .where(and(eq(file.id, fileId), eq(file.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "File not found");
  return row;
}

export async function getFolderInWorkspace(workspaceId: string, folderId: string) {
  const [row] = await db
    .select()
    .from(folder)
    .where(and(eq(folder.id, folderId), eq(folder.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "Folder not found");
  return row;
}

export async function listFolderContents(
  ctx: AuthorizedContext,
  input: { parentId?: string | null; search?: string | null },
) {
  const workspaceId = ctx.workspace.id;
  let targetFolderId = input.parentId ?? null;
  const LIST_CAP = 500;

  if (!input.search) {
    if (!targetFolderId) {
      const root = await getRootFolder(workspaceId);
      targetFolderId = root?.id ?? null;
    } else {
      await getFolderInWorkspace(workspaceId, targetFolderId);
    }
  }

  const folderFilters = [eq(folder.workspaceId, workspaceId), notHidden(folder.id, workspaceId)];
  const fileFilters = [eq(file.workspaceId, workspaceId), notHidden(file.id, workspaceId)];

  if (input.search) {
    const pattern = `%${escapeIlike(input.search.slice(0, 200))}%`;
    folderFilters.push(ilike(folder.name, pattern));
    fileFilters.push(ilike(file.name, pattern));
  } else {
    folderFilters.push(targetFolderId ? eq(folder.parentId, targetFolderId) : isNull(folder.parentId));
    fileFilters.push(targetFolderId ? eq(file.folderId, targetFolderId) : isNull(file.folderId));
  }

  const [dbFolders, dbFiles, favoriteRows, breadcrumbs] = await Promise.all([
    db.select().from(folder).where(and(...folderFilters)).limit(LIST_CAP),
    db.select().from(file).where(and(...fileFilters)).limit(LIST_CAP),
    db
      .select({ itemId: favorite.itemId })
      .from(favorite)
      .where(and(eq(favorite.workspaceId, workspaceId), eq(favorite.userId, ctx.actor.id))),
    targetFolderId ? folderBreadcrumbs(workspaceId, targetFolderId) : Promise.resolve([]),
  ]);

  const favoriteIds = new Set(favoriteRows.map((f) => f.itemId));
  const itemIds = [...dbFolders.map((f) => f.id), ...dbFiles.map((f) => f.id)];

  const [tagRows, owners, previewUrls] = await Promise.all([
    itemIds.length > 0
      ? db
          .select({ itemId: itemTag.itemId, id: tag.id, name: tag.name, color: tag.color })
          .from(itemTag)
          .innerJoin(tag, eq(itemTag.tagId, tag.id))
          .where(and(eq(itemTag.workspaceId, workspaceId), inArray(itemTag.itemId, itemIds)))
      : Promise.resolve([]),
    usersByIds([...dbFolders.map((f) => f.createdBy), ...dbFiles.map((f) => f.createdBy)]),
    previewUrlsByFileId(dbFiles),
  ]);

  const tagsByItemId = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of tagRows) {
    const list = tagsByItemId.get(row.itemId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    tagsByItemId.set(row.itemId, list);
  }

  const formattedFolders: ListedItem[] = dbFolders
    .filter((f) => f.name !== "root")
    .map((f) => {
      const owner = f.createdBy ? owners.get(f.createdBy) : undefined;
      return {
        id: f.id,
        parentId: f.parentId,
        type: "folder" as const,
        name: f.name,
        mimeType: null,
        size: null,
        updatedAt: f.updatedAt.toISOString(),
        owner: owner?.name ?? ctx.actor.name,
        ownerId: f.createdBy ?? ctx.actor.id,
        isFavorite: favoriteIds.has(f.id),
        tags: tagsByItemId.get(f.id) ?? [],
        color: f.color,
      };
    });

  const formattedFiles: ListedItem[] = dbFiles.map((f) => {
    const owner = f.createdBy ? owners.get(f.createdBy) : undefined;
    return {
      id: f.id,
      parentId: f.folderId,
      type: "file" as const,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt.toISOString(),
      owner: owner?.name ?? ctx.actor.name,
      ownerId: f.createdBy ?? ctx.actor.id,
      isFavorite: favoriteIds.has(f.id),
      tags: tagsByItemId.get(f.id) ?? [],
      hasThumbnail: Boolean(f.thumbnailKey),
      thumbnailUrl: previewUrls.get(f.id),
    };
  });

  return {
    workspaceId,
    currentFolderId: targetFolderId,
    breadcrumbs,
    items: [...formattedFolders, ...formattedFiles],
  };
}

export async function createFolder(ctx: AuthorizedContext, input: { name: string; parentId?: string | null }) {
  const requested = assertSafeItemName(input.name);
  const parent = await resolveFolderInWorkspace(ctx.workspace.id, input.parentId);
  const name = await uniqueFolderName(ctx.workspace.id, parent.id, requested);
  const [created] = await db
    .insert(folder)
    .values({
      workspaceId: ctx.workspace.id,
      parentId: parent.id,
      name,
      createdBy: ctx.actor.id,
    })
    .returning();
  if (created) {
    await recordAudit({
      workspaceId: ctx.workspace.id,
      actorId: ctx.actor.id,
      action: "folder.create",
      targetType: "folder",
      targetId: created.id,
      metadata: { name: created.name },
    });
  }
  return created;
}

export async function updateFolder(
  ctx: AuthorizedContext,
  input: { id: string; name?: string; targetFolderId?: string | null; color?: string },
) {
  const current = await getFolderInWorkspace(ctx.workspace.id, input.id);

  if (input.color !== undefined && !FOLDER_COLOR_VALUES.has(input.color)) {
    throw new ServiceError(400, "Invalid color");
  }

  const updateData: { name?: string; parentId?: string; color?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.color !== undefined) updateData.color = input.color === "default" ? null : input.color;

  if (input.targetFolderId !== undefined) {
    const target =
      input.targetFolderId === null || input.targetFolderId === "root"
        ? await getRootFolder(ctx.workspace.id)
        : await getFolderInWorkspace(ctx.workspace.id, input.targetFolderId);
    if (!target) throw new ServiceError(400, "Target folder not found");
    await assertFolderMoveAllowed(ctx.workspace.id, input.id, target.id);
    const desiredName = input.name !== undefined ? assertSafeItemName(input.name) : current.name;
    updateData.parentId = target.id;
    updateData.name = await uniqueFolderName(ctx.workspace.id, target.id, desiredName, current.id);
  } else if (input.name !== undefined) {
    const desiredName = assertSafeItemName(input.name);
    if (desiredName !== current.name) {
      if (!current.parentId) throw new ServiceError(400, "Cannot rename the root folder");
      if (await folderNameTaken(ctx.workspace.id, current.parentId, desiredName, current.id)) {
        throw new ServiceError(409, "A folder with this name already exists");
      }
      updateData.name = desiredName;
    }
  }

  const [updated] = await db
    .update(folder)
    .set(updateData)
    .where(and(eq(folder.id, input.id), eq(folder.workspaceId, ctx.workspace.id)))
    .returning();
  if (!updated) throw new ServiceError(404, "Folder not found");
  if (input.name !== undefined) {
    await recordAudit({
      workspaceId: ctx.workspace.id,
      actorId: ctx.actor.id,
      action: "folder.rename",
      targetType: "folder",
      targetId: updated.id,
      metadata: { name: updated.name },
    });
  } else if (input.targetFolderId !== undefined) {
    await recordAudit({
      workspaceId: ctx.workspace.id,
      actorId: ctx.actor.id,
      action: "folder.move",
      targetType: "folder",
      targetId: updated.id,
      metadata: { name: updated.name },
    });
  }
  return updated;
}

export async function updateFile(
  ctx: AuthorizedContext,
  input: { id: string; name?: string; targetFolderId?: string | null },
) {
  const current = await getFileInWorkspace(ctx.workspace.id, input.id);

  const updateData: { name?: string; folderId?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.targetFolderId !== undefined) {
    const target =
      input.targetFolderId === null || input.targetFolderId === "root"
        ? await getRootFolder(ctx.workspace.id)
        : await getFolderInWorkspace(ctx.workspace.id, input.targetFolderId);
    if (!target) throw new ServiceError(400, "Target folder not found");
    const desiredName = input.name !== undefined ? assertSafeItemName(input.name) : current.name;
    updateData.folderId = target.id;
    updateData.name = await uniqueFileName(ctx.workspace.id, target.id, desiredName, current.id);
  } else if (input.name !== undefined) {
    const desiredName = assertSafeItemName(input.name);
    if (desiredName !== current.name) {
      if (await fileNameTaken(ctx.workspace.id, current.folderId, desiredName, current.id)) {
        throw new ServiceError(409, "A file with this name already exists");
      }
      updateData.name = desiredName;
    }
  }

  const [updated] = await db
    .update(file)
    .set(updateData)
    .where(and(eq(file.id, input.id), eq(file.workspaceId, ctx.workspace.id)))
    .returning();
  if (!updated) throw new ServiceError(404, "File not found");
  if (input.name !== undefined) {
    await recordAudit({
      workspaceId: ctx.workspace.id,
      actorId: ctx.actor.id,
      action: "file.rename",
      targetType: "file",
      targetId: updated.id,
      metadata: { name: updated.name },
    });
  } else if (input.targetFolderId !== undefined) {
    await recordAudit({
      workspaceId: ctx.workspace.id,
      actorId: ctx.actor.id,
      action: "file.move",
      targetType: "file",
      targetId: updated.id,
      metadata: { name: updated.name },
    });
  }
  return updated;
}

export async function trashItemInWorkspace(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  await trashItemsInWorkspace(ctx, [input]);
}

export async function trashItemsInWorkspace(
  ctx: AuthorizedContext,
  inputs: Array<{ id: string; type: "file" | "folder" }>,
) {
  if (inputs.length === 0) return;

  const fileIds = inputs.filter((item) => item.type === "file").map((item) => item.id);
  const folderIds = inputs.filter((item) => item.type === "folder").map((item) => item.id);
  const [foundFiles, foundFolders] = await Promise.all([
    fileIds.length > 0
      ? db
          .select({ id: file.id })
          .from(file)
          .where(and(eq(file.workspaceId, ctx.workspace.id), inArray(file.id, fileIds)))
      : Promise.resolve([]),
    folderIds.length > 0
      ? db
          .select({ id: folder.id })
          .from(folder)
          .where(and(eq(folder.workspaceId, ctx.workspace.id), inArray(folder.id, folderIds)))
      : Promise.resolve([]),
  ]);
  if (foundFiles.length !== fileIds.length || foundFolders.length !== folderIds.length) {
    throw new ServiceError(404, "Item not found");
  }

  const descendantLists = await Promise.all(
    folderIds.map((id) => collectDescendantItems(ctx.workspace.id, id)),
  );
  const toTrash: Array<{ id: string; type: "file" | "folder" }> = [...inputs];
  for (const descendants of descendantLists) {
    toTrash.push(...descendants);
  }

  const uniqueItems = [...new Map(toTrash.map((item) => [item.id, item])).values()];
  const uniqueIds = uniqueItems.map((item) => item.id);
  const existing = await db
    .select({ itemId: trashItem.itemId })
    .from(trashItem)
    .where(and(eq(trashItem.workspaceId, ctx.workspace.id), inArray(trashItem.itemId, uniqueIds)));
  const alreadyTrashed = new Set(existing.map((row) => row.itemId));

  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + (await getTrashRetentionDays()));

  const rows = uniqueItems
    .filter((item) => !alreadyTrashed.has(item.id))
    .map((item) => ({
      workspaceId: ctx.workspace.id,
      itemType: item.type,
      itemId: item.id,
      deletedBy: ctx.actor.id,
      purgeAt,
    }));
  if (rows.length > 0) {
    await db.insert(trashItem).values(rows);
  }

  await Promise.all(
    inputs.map((input) =>
      recordAudit({
        workspaceId: ctx.workspace.id,
        actorId: ctx.actor.id,
        action: input.type === "file" ? "file.trash" : "folder.trash",
        targetType: input.type,
        targetId: input.id,
      }),
    ),
  );
}

export async function permanentlyDeleteItem(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  assertOwner(ctx);
  if (input.type === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
  }

  const storageKeys = await collectItemStorageKeys(ctx.workspace.id, input);
  await deleteStoredFiles(storageKeys);

  if (input.type === "file") {
    await db.delete(file).where(and(eq(file.id, input.id), eq(file.workspaceId, ctx.workspace.id)));
  } else {
    await db.delete(folder).where(and(eq(folder.id, input.id), eq(folder.workspaceId, ctx.workspace.id)));
  }
  await db.delete(trashItem).where(and(eq(trashItem.itemId, input.id), eq(trashItem.workspaceId, ctx.workspace.id)));
  await db.delete(favorite).where(and(eq(favorite.itemId, input.id), eq(favorite.workspaceId, ctx.workspace.id)));
  await db.delete(archiveItem).where(and(eq(archiveItem.itemId, input.id), eq(archiveItem.workspaceId, ctx.workspace.id)));
  await db.delete(itemShare).where(and(eq(itemShare.itemId, input.id), eq(itemShare.workspaceId, ctx.workspace.id)));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.delete" : "folder.delete",
    targetType: input.type,
    targetId: input.id,
  });
}

export async function writeFileContent(ctx: AuthorizedContext, fileId: string, content: string) {
  const current = await getFileInWorkspace(ctx.workspace.id, fileId);
  const isMarkdown =
    current.mimeType === "text/markdown" || current.name.toLowerCase().endsWith(".md");
  if (!isMarkdown) throw new ServiceError(400, "Only markdown files can be edited");

  const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length > MAX_MARKDOWN_BYTES) {
    throw new ServiceError(413, "Markdown file is too large");
  }
  await putStoredObject(current.storageKey, buffer, buffer.length, current.mimeType || "text/markdown");

  const [updated] = await db
    .update(file)
    .set({ size: buffer.length, updatedAt: new Date() })
    .where(and(eq(file.id, current.id), eq(file.workspaceId, ctx.workspace.id)))
    .returning();
  if (!updated) throw new ServiceError(404, "File not found");

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "file.edit",
    targetType: "file",
    targetId: updated.id,
    metadata: { name: updated.name, size: updated.size },
  });
  return updated;
}

export async function transferItem(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder"; targetWorkspaceId: string; targetFolderId?: string | null },
) {
  assertOwner(ctx);
  if (input.targetWorkspaceId === ctx.workspace.id) {
    throw new ServiceError(400, "Choose a different workspace");
  }

  const dest = await requireWorkspaceMember(ctx.actor.id, input.targetWorkspaceId);
  const destFolder = await resolveFolderInWorkspace(dest.workspace.id, input.targetFolderId);

  if (input.type === "file") {
    return transferFileToWorkspace(ctx, input.id, dest.workspace.id, destFolder.id);
  }
  return transferFolderToWorkspace(ctx, input.id, dest.workspace.id, destFolder.id);
}

async function transferFileToWorkspace(
  ctx: AuthorizedContext,
  fileId: string,
  destWorkspaceId: string,
  destFolderId: string,
) {
  const source = await getFileInWorkspace(ctx.workspace.id, fileId);
  const name = await uniqueFileName(destWorkspaceId, destFolderId, source.name);
  const storageKey = objectStorageKey(destWorkspaceId, randomUUID());
  await ensureBucket();
  await copyStoredObject(source.storageKey, storageKey);

  const [created] = await db
    .insert(file)
    .values({
      workspaceId: destWorkspaceId,
      folderId: destFolderId,
      name,
      mimeType: source.mimeType,
      size: source.size,
      storageKey,
      createdBy: ctx.actor.id,
    })
    .returning();
  if (!created) throw new ServiceError(500, "Failed to transfer file");

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "file.transfer",
    targetType: "file",
    targetId: source.id,
    metadata: { name: source.name, destWorkspaceId, destFileId: created.id },
  });
  return created;
}

async function transferFolderToWorkspace(
  ctx: AuthorizedContext,
  folderId: string,
  destWorkspaceId: string,
  destParentId: string,
) {
  const source = await getFolderInWorkspace(ctx.workspace.id, folderId);
  if (!source.parentId) throw new ServiceError(400, "Cannot transfer the root folder");
  const hidden = await hiddenItemIds(ctx.workspace.id);
  const name = await uniqueFolderName(destWorkspaceId, destParentId, source.name);

  const [created] = await db
    .insert(folder)
    .values({
      workspaceId: destWorkspaceId,
      parentId: destParentId,
      name,
      color: source.color,
      createdBy: ctx.actor.id,
    })
    .returning();
  if (!created) throw new ServiceError(500, "Failed to transfer folder");

  const childFolders = await db
    .select()
    .from(folder)
    .where(and(eq(folder.workspaceId, ctx.workspace.id), eq(folder.parentId, source.id)));
  for (const child of childFolders) {
    if (hidden.has(child.id)) continue;
    await transferFolderToWorkspace(ctx, child.id, destWorkspaceId, created.id);
  }

  const childFiles = await db
    .select()
    .from(file)
    .where(and(eq(file.workspaceId, ctx.workspace.id), eq(file.folderId, source.id)));
  for (const child of childFiles) {
    if (hidden.has(child.id)) continue;
    await transferFileToWorkspace(ctx, child.id, destWorkspaceId, created.id);
  }

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "folder.transfer",
    targetType: "folder",
    targetId: source.id,
    metadata: { name: source.name, destWorkspaceId, destFolderId: created.id },
  });
  return created;
}
