import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db, folder, file, eq, and } from "@filecloud/db";
import { ensureBucket, objectStorageKey, putStoredObject, minioClient, S3_BUCKET } from "@filecloud/storage";
import { getMimeTypeFromFilename, isBlockedUploadMimeType } from "@/lib/mime";
import { mimeMatchesDeclaration } from "@/lib/mime-sniff";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { getQuotaLimits } from "@/lib/services/instance-settings";
import { uniqueFolderName, uniqueFileName } from "@/lib/services/names";
import { workspaceUsedBytes } from "@/lib/services/quota";
import { sanitizeZipDirPath, sanitizeZipEntryPath } from "@/lib/zip-path";

const MAX_ZIP_ENTRIES = 500;
const MAX_COMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;

function declaredUncompressedSize(entry: JSZip.JSZipObject): number {
  const data = (entry as { _data?: { uncompressedSize?: number } })._data;
  return typeof data?.uncompressedSize === "number" ? data.uncompressedSize : 0;
}

/**
 * Extraction bypasses the upload denylist entirely, so an archive was a way to
 * land HTML, SVG or scripts in storage with a matching content type. Anything
 * blocked, or whose magic bytes contradict its extension, is stored as an
 * opaque blob instead: the bytes survive but the download path can only ever
 * serve them as an attachment.
 */
function safeExtractedMimeType(fileName: string, content: Buffer): string {
  const mimeType = getMimeTypeFromFilename(fileName);
  if (isBlockedUploadMimeType(mimeType)) return "application/octet-stream";
  if (!mimeMatchesDeclaration(mimeType, content.subarray(0, 16))) return "application/octet-stream";
  return mimeType;
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();

    const { allowed, retryAfter } = await checkRateLimit(`unzip:${ctx.actor.id}`, {
      windowSeconds: 300,
      max: 10,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const workspaceId = ctx.workspace.id;

    const [zipFile] = await db
      .select()
      .from(file)
      .where(and(eq(file.id, id), eq(file.workspaceId, workspaceId)))
      .limit(1);

    if (!zipFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (zipFile.mimeType !== "application/zip" && !zipFile.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Not a zip file" }, { status: 400 });
    }
    if (zipFile.size > MAX_COMPRESSED_BYTES) {
      return NextResponse.json({ error: "Archive is too large to extract" }, { status: 413 });
    }

    const stream = await minioClient.getObject(S3_BUCKET, zipFile.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));

    const entries = Object.values(zip.files);
    if (entries.length > MAX_ZIP_ENTRIES) {
      return NextResponse.json(
        { error: `Archive contains too many entries (max ${MAX_ZIP_ENTRIES})` },
        { status: 400 },
      );
    }

    let declaredTotal = 0;
    for (const entry of entries) {
      if (entry.dir) {
        if (sanitizeZipDirPath(entry.name) === null) {
          return NextResponse.json({ error: "Archive contains an unsafe path" }, { status: 400 });
        }
        continue;
      }
      if (!sanitizeZipEntryPath(entry.name)) {
        return NextResponse.json({ error: "Archive contains an unsafe path" }, { status: 400 });
      }
      declaredTotal += declaredUncompressedSize(entry);
      if (declaredTotal > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        return NextResponse.json({ error: "Archive is too large once extracted" }, { status: 413 });
      }
    }

    // Extraction used to write files without consulting the quota at all,
    // which made an archive the simplest way to push a workspace past its
    // storage limit.
    const { quotaBytes } = await getQuotaLimits();
    const usedBytes = await workspaceUsedBytes(workspaceId);
    if (usedBytes + declaredTotal > quotaBytes) {
      return NextResponse.json({ error: "Workspace storage quota exceeded" }, { status: 413 });
    }
    const remainingQuotaBytes = quotaBytes - usedBytes;

    const baseFolderName = await uniqueFolderName(
      workspaceId,
      zipFile.folderId,
      zipFile.name.replace(/\.zip$/i, "") || "archive",
    );
    const [destFolder] = await db
      .insert(folder)
      .values({ workspaceId, parentId: zipFile.folderId, name: baseFolderName, createdBy: ctx.actor.id })
      .returning();
    if (!destFolder) {
      return NextResponse.json({ error: "Failed to create destination folder" }, { status: 500 });
    }

    const folderIdByPath = new Map<string, string>([["", destFolder.id]]);

    async function ensureFolder(dirPath: string): Promise<string> {
      const existing = folderIdByPath.get(dirPath);
      if (existing) return existing;

      const segments = dirPath.split("/").filter(Boolean);
      const name = segments[segments.length - 1]!;
      const parentPath = segments.slice(0, -1).join("/");
      const parentId = await ensureFolder(parentPath);

      const finalName = await uniqueFolderName(workspaceId, parentId, name);
      const [created] = await db
        .insert(folder)
        .values({ workspaceId, parentId, name: finalName, createdBy: ctx.actor.id })
        .returning();
      folderIdByPath.set(dirPath, created!.id);
      return created!.id;
    }

    await ensureBucket();

    let totalUncompressedBytes = 0;
    let extractedCount = 0;

    for (const entry of entries) {
      if (entry.dir) {
        const dirPath = sanitizeZipDirPath(entry.name);
        if (dirPath === null) {
          return NextResponse.json({ error: "Archive contains an unsafe path" }, { status: 400 });
        }
        if (dirPath) await ensureFolder(dirPath);
        continue;
      }

      const parsed = sanitizeZipEntryPath(entry.name);
      if (!parsed) continue;

      const content = await entry.async("nodebuffer");
      totalUncompressedBytes += content.length;
      if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        return NextResponse.json({ error: "Archive is too large once extracted" }, { status: 413 });
      }
      // The declared sizes checked above come from the archive itself and can
      // lie, so hold the real byte count against the quota as we go.
      if (totalUncompressedBytes > remainingQuotaBytes) {
        return NextResponse.json({ error: "Workspace storage quota exceeded" }, { status: 413 });
      }

      const parentId = await ensureFolder(parsed.dirPath);
      const finalName = await uniqueFileName(workspaceId, parentId, parsed.fileName);
      const mimeType = safeExtractedMimeType(finalName, content);
      const storageKey = objectStorageKey(workspaceId, crypto.randomUUID());

      await putStoredObject(storageKey, content, content.length, mimeType);
      await db.insert(file).values({
        workspaceId,
        folderId: parentId,
        name: finalName,
        mimeType,
        size: content.length,
        storageKey,
        createdBy: ctx.actor.id,
      });
      extractedCount++;
    }

    return NextResponse.json({
      success: true,
      folder: { id: destFolder.id, name: destFolder.name },
      extractedCount,
    });
  } catch (error) {
    return jsonError(error, "Failed to extract archive");
  }
}
