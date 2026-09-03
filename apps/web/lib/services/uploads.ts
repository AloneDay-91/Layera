import { randomUUID } from "crypto";
import { Readable } from "node:stream";
import { db, upload, file, job, eq, and } from "@filecloud/db";
import {
  ensureBucket,
  objectStorageKey,
  presignPutObject,
  putStoredObject,
  readStoredObjectPrefix,
  removeStoredObject,
  statStoredObject,
  usesPublicPresign,
} from "@filecloud/storage";
import { ServiceError } from "./errors";
import type { AuthorizedContext } from "./permissions";
import { resolveFolderInWorkspace } from "./files";
import { uniqueFileName } from "./names";
import { recordAudit } from "./audit";
import { workspaceUsedBytes } from "./quota";
import { getQuotaLimits } from "./instance-settings";
import { mimeMatchesDeclaration } from "@/lib/mime-sniff";

const PRESIGN_EXPIRY_SECONDS = 15 * 60;
const THUMBNAIL_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const BLOCKED_UPLOAD_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-msdownload",
]);

async function abortUpload(uploadId: string, storageKey: string) {
  await db.update(upload).set({ status: "aborted" }).where(eq(upload.id, uploadId));
  await removeStoredObject(storageKey);
}

export async function presignUpload(
  ctx: AuthorizedContext,
  input: { name: string; size: number; mimeType?: string; folderId?: string | null },
) {
  const name = input.name.trim();
  if (!name) throw new ServiceError(400, "Name is required");
  if (!Number.isFinite(input.size) || input.size < 0) throw new ServiceError(400, "Invalid size");
  const { maxUploadBytes, quotaBytes } = await getQuotaLimits();
  if (input.size > maxUploadBytes) {
    throw new ServiceError(413, "File is too large");
  }

  const used = await workspaceUsedBytes(ctx.workspace.id);
  if (used + input.size > quotaBytes) {
    throw new ServiceError(413, "Workspace storage quota exceeded");
  }

  const folder = await resolveFolderInWorkspace(ctx.workspace.id, input.folderId);
  const mimeType = input.mimeType?.trim() || "application/octet-stream";
  if (BLOCKED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new ServiceError(415, "This file type is not allowed");
  }
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
    await abortUpload(row.id, row.storageKey);
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
  const { maxUploadBytes, quotaBytes } = await getQuotaLimits();
  if (storedSize !== row.size || storedSize > maxUploadBytes) {
    await abortUpload(row.id, row.storageKey);
    throw new ServiceError(400, "Uploaded size does not match");
  }

  const used = await workspaceUsedBytes(ctx.workspace.id);
  if (used + storedSize > quotaBytes) {
    await abortUpload(row.id, row.storageKey);
    throw new ServiceError(413, "Workspace storage quota exceeded");
  }

  if (storedSize > 0) {
    try {
      const prefix = await readStoredObjectPrefix(row.storageKey, 16);
      if (!mimeMatchesDeclaration(row.mimeType, prefix)) {
        await abortUpload(row.id, row.storageKey);
        throw new ServiceError(400, "File content does not match the declared type");
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      await abortUpload(row.id, row.storageKey);
      throw new ServiceError(400, "Unable to verify uploaded file");
    }
  }

  const name = await uniqueFileName(ctx.workspace.id, row.folderId, row.fileName);
  const [created] = await db
    .insert(file)
    .values({
      workspaceId: ctx.workspace.id,
      folderId: row.folderId,
      name,
      mimeType: row.mimeType,
      size: storedSize,
      storageKey: row.storageKey,
      createdBy: ctx.actor.id,
    })
    .returning();
  if (!created) throw new ServiceError(500, "Failed to create file");

  await db.update(upload).set({ status: "completed" }).where(eq(upload.id, row.id));

  if (THUMBNAIL_MIME_TYPES.has(created.mimeType)) {
    await db.insert(job).values({
      type: "thumbnail",
      payload: { fileId: created.id },
    });
  }

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "file.upload",
    targetType: "file",
    targetId: created.id,
    metadata: { name: created.name, size: created.size },
  });

  return {
    id: created.id,
    name: created.name,
    size: created.size,
    mimeType: created.mimeType,
    updatedAt: created.updatedAt.toISOString(),
  };
}
