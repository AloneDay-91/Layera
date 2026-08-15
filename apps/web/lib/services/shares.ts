import { db, shareLink, file, folder, eq, and, isNull, inArray } from "@filecloud/db";
import { randomBytes } from "crypto";
import { hashSharePassword } from "@/lib/share-password";
import { ServiceError } from "./errors";
import { assertOwner, type AuthorizedContext } from "./permissions";
import { getFileInWorkspace, getFolderInWorkspace } from "./files";
import { recordAudit } from "./audit";

export async function listShareLinks(ctx: AuthorizedContext) {
  const shares = await db
    .select()
    .from(shareLink)
    .where(
      and(
        eq(shareLink.workspaceId, ctx.workspace.id),
        eq(shareLink.createdBy, ctx.actor.id),
        isNull(shareLink.revokedAt),
      ),
    );

  const fileIds = shares.map((s) => s.fileId).filter((id): id is string => Boolean(id));
  const folderIds = shares.map((s) => s.folderId).filter((id): id is string => Boolean(id));
  const [files, folders] = await Promise.all([
    fileIds.length > 0 ? db.select({ id: file.id, name: file.name }).from(file).where(inArray(file.id, fileIds)) : Promise.resolve([]),
    folderIds.length > 0
      ? db.select({ id: folder.id, name: folder.name }).from(folder).where(inArray(folder.id, folderIds))
      : Promise.resolve([]),
  ]);
  const fileNameById = new Map(files.map((row) => [row.id, row.name]));
  const folderNameById = new Map(folders.map((row) => [row.id, row.name]));

  return shares.map((s) => {
    const itemType: "file" | "folder" = s.fileId ? "file" : "folder";
    const itemName =
      (s.fileId ? fileNameById.get(s.fileId) : s.folderId ? folderNameById.get(s.folderId) : undefined) ?? "Élément";
    return {
      id: s.id,
      token: s.token,
      itemName,
      itemType,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
      hasPassword: s.passwordHash !== null,
    };
  });
}

export async function createShareLink(
  ctx: AuthorizedContext,
  input: { itemId: string; itemType: "file" | "folder"; expiresAt?: string | null; password?: string },
) {
  assertOwner(ctx);
  if (input.itemType === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.itemId);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.itemId);
  }

  if (input.expiresAt !== undefined && input.expiresAt !== null && Number.isNaN(Date.parse(input.expiresAt))) {
    throw new ServiceError(400, "Invalid expiresAt");
  }

  const token = randomBytes(32).toString("hex");
  const values: {
    token: string;
    createdBy: string;
    workspaceId: string;
    fileId?: string;
    folderId?: string;
    expiresAt?: Date;
    passwordHash?: string;
  } = {
    token,
    createdBy: ctx.actor.id,
    workspaceId: ctx.workspace.id,
  };

  if (input.itemType === "file") values.fileId = input.itemId;
  else values.folderId = input.itemId;
  if (input.expiresAt) values.expiresAt = new Date(input.expiresAt);
  if (typeof input.password === "string" && input.password.length > 0) {
    values.passwordHash = hashSharePassword(input.password);
  }

  const [created] = await db.insert(shareLink).values(values).returning();
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "share.create",
    targetType: "share",
    targetId: created?.id,
    metadata: { itemType: input.itemType, itemId: input.itemId },
  });
  return {
    id: created?.id,
    token: created?.token,
    url: `/share/${created?.token}`,
  };
}

export async function updateShareLink(
  ctx: AuthorizedContext,
  input: { id: string; expiresAt?: string | null; password?: string | null },
) {
  assertOwner(ctx);
  const [existing] = await db
    .select()
    .from(shareLink)
    .where(
      and(eq(shareLink.id, input.id), eq(shareLink.workspaceId, ctx.workspace.id), eq(shareLink.createdBy, ctx.actor.id)),
    )
    .limit(1);
  if (!existing) throw new ServiceError(404, "Share link not found");

  const updateData: { expiresAt?: Date | null; passwordHash?: string | null } = {};
  if (input.expiresAt !== undefined) {
    if (input.expiresAt === null) {
      updateData.expiresAt = null;
    } else if (Number.isNaN(Date.parse(input.expiresAt))) {
      throw new ServiceError(400, "Invalid expiresAt");
    } else {
      updateData.expiresAt = new Date(input.expiresAt);
    }
  }
  if (input.password !== undefined) {
    updateData.passwordHash =
      typeof input.password === "string" && input.password.length > 0 ? hashSharePassword(input.password) : null;
  }

  const [updated] = await db.update(shareLink).set(updateData).where(eq(shareLink.id, input.id)).returning();
  return {
    id: updated?.id,
    expiresAt: updated?.expiresAt ? updated.expiresAt.toISOString() : null,
    hasPassword: updated?.passwordHash !== null,
  };
}

export async function revokeShareLink(ctx: AuthorizedContext, shareId: string) {
  assertOwner(ctx);
  const [updated] = await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(shareLink.id, shareId), eq(shareLink.workspaceId, ctx.workspace.id), eq(shareLink.createdBy, ctx.actor.id)),
    )
    .returning();
  if (!updated) throw new ServiceError(404, "Share link not found");
  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "share.revoke",
    targetType: "share",
    targetId: updated.id,
  });
}
