import { db, file, folder, itemShare, workspaceMember, eq, and, inArray } from "@filecloud/db";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { getFileInWorkspace, getFolderInWorkspace } from "./files";
import { findUserByEmail, usersByIds } from "./users";
import { recordAudit } from "./audit";
import { hiddenItemIds } from "./hidden";

async function isWorkspaceMember(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId)))
    .limit(1);
  return Boolean(row);
}

async function hasDirectShare(actorId: string, itemId: string) {
  const [row] = await db
    .select({ id: itemShare.id })
    .from(itemShare)
    .where(and(eq(itemShare.itemId, itemId), eq(itemShare.sharedWithUserId, actorId)))
    .limit(1);
  return Boolean(row);
}

export async function canAccessFile(actorId: string, fileRow: { id: string; workspaceId: string; folderId: string }) {
  if (await isWorkspaceMember(fileRow.workspaceId, actorId)) return true;
  if (await hasDirectShare(actorId, fileRow.id)) return true;

  let folderId: string | null = fileRow.folderId;
  while (folderId) {
    if (await hasDirectShare(actorId, folderId)) return true;
    const [parent] = await db.select({ parentId: folder.parentId }).from(folder).where(eq(folder.id, folderId)).limit(1);
    folderId = parent?.parentId ?? null;
  }
  return false;
}

export async function createItemShare(
  ctx: AuthorizedContext,
  input: { itemId: string; itemType: "file" | "folder"; email?: string; userId?: string },
) {
  if (input.itemType === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.itemId);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.itemId);
  }

  let targetUserId = input.userId?.trim() || null;
  if (!targetUserId && input.email) {
    const target = await findUserByEmail(input.email);
    if (!target) throw new ServiceError(404, "No account with this email");
    targetUserId = target.id;
  }
  if (!targetUserId) throw new ServiceError(400, "A workspace member is required");
  if (targetUserId === ctx.actor.id) throw new ServiceError(400, "You cannot share with yourself");

  if (!(await isWorkspaceMember(ctx.workspace.id, targetUserId))) {
    throw new ServiceError(400, "User is not a member of this workspace");
  }

  const [existing] = await db
    .select({ id: itemShare.id })
    .from(itemShare)
    .where(and(eq(itemShare.itemId, input.itemId), eq(itemShare.sharedWithUserId, targetUserId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(itemShare)
    .values({
      workspaceId: ctx.workspace.id,
      itemType: input.itemType,
      itemId: input.itemId,
      sharedBy: ctx.actor.id,
      sharedWithUserId: targetUserId,
    })
    .returning();
  if (!created) throw new ServiceError(500, "Failed to share item");

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "share.internal",
    targetType: input.itemType,
    targetId: input.itemId,
    metadata: { sharedWithUserId: targetUserId },
  });
  return created;
}

export async function listItemSharesForItem(ctx: AuthorizedContext, itemId: string) {
  const rows = await db
    .select()
    .from(itemShare)
    .where(and(eq(itemShare.workspaceId, ctx.workspace.id), eq(itemShare.itemId, itemId)));
  const people = await usersByIds(rows.map((row) => row.sharedWithUserId));
  return rows.map((row) => ({
    id: row.id,
    userId: row.sharedWithUserId,
    name: people.get(row.sharedWithUserId)?.name ?? "Utilisateur",
    email: people.get(row.sharedWithUserId)?.email ?? "",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function revokeItemShare(ctx: AuthorizedContext, shareId: string) {
  const [updated] = await db
    .delete(itemShare)
    .where(and(eq(itemShare.id, shareId), eq(itemShare.workspaceId, ctx.workspace.id)))
    .returning();
  if (!updated) throw new ServiceError(404, "Share not found");
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "share.internal-revoke",
    targetType: updated.itemType,
    targetId: updated.itemId,
  });
}

export async function listSharedWithMe(actorId: string) {
  const rows = await db.select().from(itemShare).where(eq(itemShare.sharedWithUserId, actorId));
  if (rows.length === 0) return [];

  const people = await usersByIds(rows.map((row) => row.sharedBy));
  const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
  const hiddenByWorkspace = new Map<string, Set<string>>();
  await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      hiddenByWorkspace.set(workspaceId, await hiddenItemIds(workspaceId));
    }),
  );

  const fileIds = rows.filter((row) => row.itemType === "file").map((row) => row.itemId);
  const folderIds = rows.filter((row) => row.itemType === "folder").map((row) => row.itemId);
  const [files, folders] = await Promise.all([
    fileIds.length > 0 ? db.select().from(file).where(inArray(file.id, fileIds)) : Promise.resolve([]),
    folderIds.length > 0 ? db.select().from(folder).where(inArray(folder.id, folderIds)) : Promise.resolve([]),
  ]);
  const fileById = new Map(files.map((row) => [row.id, row]));
  const folderById = new Map(folders.map((row) => [row.id, row]));

  const items = [];
  for (const row of rows) {
    const hidden = hiddenByWorkspace.get(row.workspaceId) ?? new Set();
    if (hidden.has(row.itemId)) continue;
    const sharedBy = people.get(row.sharedBy);

    if (row.itemType === "file") {
      const fRecord = fileById.get(row.itemId);
      if (!fRecord) continue;
      items.push({
        id: fRecord.id,
        shareId: row.id,
        parentId: fRecord.folderId,
        type: "file" as const,
        name: fRecord.name,
        mimeType: fRecord.mimeType,
        size: fRecord.size,
        updatedAt: fRecord.updatedAt.toISOString(),
        owner: sharedBy?.name ?? "Utilisateur",
        ownerId: row.sharedBy,
        sharedBy: sharedBy ? { id: sharedBy.id, name: sharedBy.name } : null,
        workspaceId: row.workspaceId,
        hasThumbnail: Boolean(fRecord.thumbnailKey),
      });
    } else {
      const fldRecord = folderById.get(row.itemId);
      if (!fldRecord) continue;
      items.push({
        id: fldRecord.id,
        shareId: row.id,
        parentId: fldRecord.parentId,
        type: "folder" as const,
        name: fldRecord.name,
        mimeType: null,
        size: null,
        updatedAt: fldRecord.updatedAt.toISOString(),
        owner: sharedBy?.name ?? "Utilisateur",
        ownerId: row.sharedBy,
        sharedBy: sharedBy ? { id: sharedBy.id, name: sharedBy.name } : null,
        workspaceId: row.workspaceId,
        color: fldRecord.color,
      });
    }
  }

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
