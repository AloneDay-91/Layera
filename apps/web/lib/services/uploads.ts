import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import { db, upload, file, eq, and } from "@filecloud/db";
import {
  ensureBucket,
  objectStorageKey,
  presignPutObject,
  putStoredObject,
  statStoredObject,
  usesPublicPresign,
} from "@filecloud/storage";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { resolveFolderInWorkspace } from "./files";

const PRESIGN_EXPIRY_SECONDS = 15 * 60;
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024 * 1024);

export async function presignUpload(
  ctx: AuthorizedContext,
  input: { name: string; size: number; mimeType?: string; folderId?: string | null },
) {
  const name = input.name.trim();
  if (!name) throw new ServiceError(400, "Name is required");
  if (!Number.isFinite(input.size) || input.size < 0) throw new ServiceError(400, "Invalid size");
  if (input.size > MAX_UPLOAD_BYTES) {
    throw new ServiceError(413, "File is too large");
  }

  const folder = await resolveFolderInWorkspace(ctx.workspace.id, input.folderId);
  const mimeType = input.mimeType?.trim() || "application/octet-stream";
  const objectId = randomUUID();
  const storageKey = objectStorageKey(ctx.workspace.id, objectId);
  const expiresAt = new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000);

  await ensureBucket();

  const [pending] = await db
    .insert(upload)
    .values({
      workspaceId: ctx.workspace.id,
      folderId: folder.id,
      fileName: name,
      mimeType,
      size: input.size,
      storageKey,
      status: "pending",
      expiresAt,
      createdBy: ctx.actor.id,
    })
    .returning();
  if (!pending) throw new ServiceError(500, "Failed to create upload");

  const url = usesPublicPresign
    ? await presignPutObject(storageKey, PRESIGN_EXPIRY_SECONDS, mimeType)
    : `/api/uploads/${pending.id}`;

  return {
    uploadId: pending.id,
    url,
    method: "PUT" as const,
    headers: { "Content-Type": mimeType },
    expiresAt: expiresAt.toISOString(),
  };
}

async function getOwnedPendingUpload(ctx: AuthorizedContext, uploadId: string) {
  const [row] = await db
    .select()
    .from(upload)
    .where(
      and(eq(upload.id, uploadId), eq(upload.workspaceId, ctx.workspace.id), eq(upload.createdBy, ctx.actor.id)),
    )
    .limit(1);
  if (!row) throw new ServiceError(404, "Upload not found");
  if (row.status !== "pending") throw new ServiceError(409, "Upload is no longer pending");
  if (row.expiresAt < new Date()) {
    await db.update(upload).set({ status: "aborted" }).where(eq(upload.id, row.id));
    throw new ServiceError(410, "Upload expired");
  }
  return row;
}

export async function putUploadStream(ctx: AuthorizedContext, uploadId: string, body: Readable, declaredType?: string | null) {
  const row = await getOwnedPendingUpload(ctx, uploadId);
  await ensureBucket();
  await putStoredObject(row.storageKey, body, row.size, declaredType || row.mimeType);
}

export async function completeUpload(ctx: AuthorizedContext, uploadId: string) {
  const row = await getOwnedPendingUpload(ctx, uploadId);

  let stat;
  try {
    stat = await statStoredObject(row.storageKey);
  } catch {
    throw new ServiceError(400, "Object not found in storage");
  }

  const storedSize = typeof stat.size === "number" ? stat.size : row.size;
  if (row.size > 0 && storedSize !== row.size) {
    await db.update(upload).set({ status: "aborted" }).where(eq(upload.id, row.id));
    throw new ServiceError(400, "Uploaded size does not match");
  }

  const [created] = await db
    .insert(file)
    .values({
      workspaceId: ctx.workspace.id,
      folderId: row.folderId,
      name: row.fileName,
      mimeType: row.mimeType,
      size: storedSize,
      storageKey: row.storageKey,
    })
    .returning();
  if (!created) throw new ServiceError(500, "Failed to create file");

  await db.update(upload).set({ status: "completed" }).where(eq(upload.id, row.id));

  return {
    id: created.id,
    name: created.name,
    size: created.size,
    mimeType: created.mimeType,
    storageKey: created.storageKey,
    updatedAt: created.updatedAt.toISOString(),
  };
}
