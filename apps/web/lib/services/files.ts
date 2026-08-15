import {
  db,
  folder,
  file,
  trashItem,
  favorite,
  tag,
  itemTag,
  eq,
  and,
  isNull,
  ilike,
  inArray,
} from "@filecloud/db";
import { FOLDER_COLOR_OPTIONS } from "@/lib/folder-colors";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { recordAudit } from "./audit";

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
  isFavorite: boolean;
  tags: { id: string; name: string; color: string }[];
  color?: string | null;
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
  let dbFolders;
  let dbFiles;

  if (input.search) {
    const pattern = `%${escapeIlike(input.search)}%`;
    dbFolders = await db
      .select()
      .from(folder)
      .where(and(eq(folder.workspaceId, workspaceId), ilike(folder.name, pattern)));
    dbFiles = await db
      .select()
      .from(file)
      .where(and(eq(file.workspaceId, workspaceId), ilike(file.name, pattern)));
  } else {
    if (!targetFolderId) {
      const root = await getRootFolder(workspaceId);
      targetFolderId = root?.id ?? null;
    } else {
      await getFolderInWorkspace(workspaceId, targetFolderId);
    }

    const folderCondition = targetFolderId ? eq(folder.parentId, targetFolderId) : isNull(folder.parentId);
    dbFolders = await db.select().from(folder).where(and(eq(folder.workspaceId, workspaceId), folderCondition));

    const fileCondition = targetFolderId ? eq(file.folderId, targetFolderId) : isNull(file.folderId);
    dbFiles = await db.select().from(file).where(and(eq(file.workspaceId, workspaceId), fileCondition));
  }

  const favoriteRows = await db
    .select({ itemId: favorite.itemId })
    .from(favorite)
    .where(and(eq(favorite.workspaceId, workspaceId), eq(favorite.userId, ctx.actor.id)));
  const favoriteIds = new Set(favoriteRows.map((f) => f.itemId));

  const itemIds = [...dbFolders.map((f) => f.id), ...dbFiles.map((f) => f.id)];
  const tagsByItemId = new Map<string, { id: string; name: string; color: string }[]>();
  if (itemIds.length > 0) {
    const tagRows = await db
      .select({ itemId: itemTag.itemId, id: tag.id, name: tag.name, color: tag.color })
      .from(itemTag)
      .innerJoin(tag, eq(itemTag.tagId, tag.id))
      .where(and(eq(itemTag.workspaceId, workspaceId), inArray(itemTag.itemId, itemIds)));
    for (const row of tagRows) {
      const list = tagsByItemId.get(row.itemId) ?? [];
      list.push({ id: row.id, name: row.name, color: row.color });
      tagsByItemId.set(row.itemId, list);
    }
  }

  const formattedFolders: ListedItem[] = dbFolders
    .filter((f) => f.name !== "root")
    .map((f) => ({
      id: f.id,
      parentId: f.parentId,
      type: "folder" as const,
      name: f.name,
      mimeType: null,
      size: null,
      updatedAt: f.updatedAt.toISOString(),
      owner: ctx.actor.name,
      isFavorite: favoriteIds.has(f.id),
      tags: tagsByItemId.get(f.id) ?? [],
      color: f.color,
    }));

  const formattedFiles: ListedItem[] = dbFiles.map((f) => ({
    id: f.id,
    parentId: f.folderId,
    type: "file" as const,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    updatedAt: f.updatedAt.toISOString(),
    owner: ctx.actor.name,
    isFavorite: favoriteIds.has(f.id),
    tags: tagsByItemId.get(f.id) ?? [],
  }));

  const breadcrumbs: Array<{ id: string; name: string }> = [];
  let currId = targetFolderId;
  while (currId) {
    const [f] = await db.select().from(folder).where(eq(folder.id, currId)).limit(1);
    if (!f || f.workspaceId !== workspaceId) break;
    if (f.name !== "root") {
      breadcrumbs.unshift({ id: f.id, name: f.name });
    }
    currId = f.parentId;
  }

  const trashedRows = await db
    .select({ itemId: trashItem.itemId })
    .from(trashItem)
    .where(eq(trashItem.workspaceId, workspaceId));
  const trashedIds = new Set(trashedRows.map((t) => t.itemId));

  return {
    workspaceId,
    currentFolderId: targetFolderId,
    breadcrumbs,
    items: [...formattedFolders, ...formattedFiles].filter((item) => !trashedIds.has(item.id)),
  };
}

export async function createFolder(ctx: AuthorizedContext, input: { name: string; parentId?: string | null }) {
  const name = input.name.trim();
  if (!name) throw new ServiceError(400, "Name is required");
  const parent = await resolveFolderInWorkspace(ctx.workspace.id, input.parentId);
  const [created] = await db
    .insert(folder)
    .values({
      workspaceId: ctx.workspace.id,
      parentId: parent.id,
      name,
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
  await getFolderInWorkspace(ctx.workspace.id, input.id);

  if (input.color !== undefined && !FOLDER_COLOR_VALUES.has(input.color)) {
    throw new ServiceError(400, "Invalid color");
  }

  const updateData: { name?: string; parentId?: string; color?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.color !== undefined) updateData.color = input.color === "default" ? null : input.color;

  if (input.targetFolderId !== undefined) {
    const target =
      input.targetFolderId === null || input.targetFolderId === "root"
        ? await getRootFolder(ctx.workspace.id)
        : await getFolderInWorkspace(ctx.workspace.id, input.targetFolderId);
    if (!target) throw new ServiceError(400, "Target folder not found");
    if (target.id === input.id) throw new ServiceError(400, "Cannot move a folder into itself");
    updateData.parentId = target.id;
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
  await getFileInWorkspace(ctx.workspace.id, input.id);

  const updateData: { name?: string; folderId?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.targetFolderId !== undefined) {
    const target =
      input.targetFolderId === null || input.targetFolderId === "root"
        ? await getRootFolder(ctx.workspace.id)
        : await getFolderInWorkspace(ctx.workspace.id, input.targetFolderId);
    if (!target) throw new ServiceError(400, "Target folder not found");
    updateData.folderId = target.id;
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
  if (input.type === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
  }

  const existing = await db
    .select({ id: trashItem.id })
    .from(trashItem)
    .where(and(eq(trashItem.workspaceId, ctx.workspace.id), eq(trashItem.itemId, input.id)))
    .limit(1);
  if (existing[0]) return;

  const purgeAt = new Date();
  purgeAt.setDate(purgeAt.getDate() + 30);

  await db.insert(trashItem).values({
    workspaceId: ctx.workspace.id,
    itemType: input.type,
    itemId: input.id,
    deletedBy: ctx.actor.id,
    purgeAt,
  });
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.trash" : "folder.trash",
    targetType: input.type,
    targetId: input.id,
  });
}

export async function permanentlyDeleteItem(
  ctx: AuthorizedContext,
  input: { id: string; type: "file" | "folder" },
) {
  if (input.type === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.id);
    await db.delete(file).where(and(eq(file.id, input.id), eq(file.workspaceId, ctx.workspace.id)));
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.id);
    await db.delete(folder).where(and(eq(folder.id, input.id), eq(folder.workspaceId, ctx.workspace.id)));
  }
  await db.delete(trashItem).where(and(eq(trashItem.itemId, input.id), eq(trashItem.workspaceId, ctx.workspace.id)));
  await db.delete(favorite).where(and(eq(favorite.itemId, input.id), eq(favorite.workspaceId, ctx.workspace.id)));
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: input.type === "file" ? "file.delete" : "folder.delete",
    targetType: input.type,
    targetId: input.id,
  });
}
