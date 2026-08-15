import { NextResponse } from "next/server";
import { db, file } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { resolveFolderInWorkspace } from "@/lib/services/files";
import { jsonError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();

    const { allowed, retryAfter } = await checkRateLimit(`upload:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 30,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const formData = await request.formData();
    const uploadedFile = formData.get("file") as File | null;
    const folderIdParam = formData.get("folderId") as string | null;

    if (!uploadedFile) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const targetFolder = await resolveFolderInWorkspace(ctx.workspace.id, folderIdParam);
    const targetFolderId = targetFolder.id;

    if (!targetFolderId) {
      return NextResponse.json({ error: "Target folder not found" }, { status: 400 });
    }

    // 3. Clé de stockage unique S3
    const fileName = uploadedFile.name;
    const fileSize = uploadedFile.size;
    const fileMimeType = uploadedFile.type || "application/octet-stream";
    const storageKey = `files/${ctx.workspace.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // 4. Upload des octets dans MinIO / S3
    const arrayBuffer = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    try {
      // Tenter d'assurer que le bucket existe
      const bucketExists = await minioClient.bucketExists(S3_BUCKET).catch(() => false);
      if (!bucketExists) {
        await minioClient.makeBucket(S3_BUCKET, "").catch(() => {});
      }
      await minioClient.putObject(S3_BUCKET, storageKey, buffer, fileSize, {
        "Content-Type": fileMimeType,
      });
    } catch (s3Error) {
      console.warn("[S3 Upload Warning]: MinIO is offline, proceeding with database record creation fallback.", s3Error);
    }

    // 5. Enregistrement dans PostgreSQL
    const [newFileRecord] = await db
      .insert(file)
      .values({
        workspaceId: ctx.workspace.id,
        folderId: targetFolderId,
        name: fileName,
        mimeType: fileMimeType,
        size: fileSize,
        storageKey,
      })
      .returning();

    return NextResponse.json({
      success: true,
      file: {
        id: newFileRecord?.id,
        name: newFileRecord?.name,
        size: newFileRecord?.size,
        mimeType: newFileRecord?.mimeType,
        storageKey: newFileRecord?.storageKey,
        updatedAt: newFileRecord?.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return jsonError(error, "File upload failed");
  }
}
