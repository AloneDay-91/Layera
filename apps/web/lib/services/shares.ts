import { db, shareLink, file, folder, eq, and, isNull } from "@filecloud/db";
import { randomBytes } from "crypto";
import { hashSharePassword } from "@/lib/share-password";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { getFileInWorkspace, getFolderInWorkspace } from "./files";

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

  const result = [];
  for (const s of shares) {
    let itemName = "Élément";
    let itemType: "file" | "folder" = "file";

    if (s.fileId) {
      const [f] = await db.select().from(file).where(eq(file.id, s.fileId)).limit(1);
      if (f) {
        itemName = f.name;
        itemType = "file";
      }
    } else if (s.folderId) {
      const [fld] = await db.select().from(folder).where(eq(folder.id, s.folderId)).limit(1);
      if (fld) {
        itemName = fld.name;
        itemType = "folder";
      }
    }

    result.push({
      id: s.id,
      token: s.token,
      itemName,
      itemType,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
      hasPassword: s.passwordHash !== null,
    });
  }

  return result;
}

export async function createShareLink(
  ctx: AuthorizedContext,
  input: { itemId: string; itemType: "file" | "folder"; expiresAt?: string | null; password?: string },
) {
  if (input.itemType === "file") {
    await getFileInWorkspace(ctx.workspace.id, input.itemId);
  } else {
    await getFolderInWorkspace(ctx.workspace.id, input.itemId);
  }

  if (input.expiresAt !== undefined && input.expiresAt !== null && Number.isNaN(Date.parse(input.expiresAt))) {
    throw new ServiceError(400, "Invalid expiresAt");
  }

  const token = randomBytes(12).toString("hex");
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
  const [updated] = await db
    .update(shareLink)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(shareLink.id, shareId), eq(shareLink.workspaceId, ctx.workspace.id), eq(shareLink.createdBy, ctx.actor.id)),
    )
    .returning();
  if (!updated) throw new ServiceError(404, "Share link not found");
}
