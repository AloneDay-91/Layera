import { NextResponse } from "next/server";
import { db, file, eq } from "@filecloud/db";
import { getAuthorizedWorkspace, requireSession } from "@/lib/services/permissions";
import { writeFileContent } from "@/lib/services/files";
import { canAccessFile } from "@/lib/services/item-shares";
import { jsonError } from "@/lib/services/http";
import { recordAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/errors";
import { storedObjectResponse } from "@/lib/http-file";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

// SVG and HTML are deliberately excluded — they can embed <script> and
// execute it when navigated to directly (Content-Disposition: inline),
// unlike raster/media formats and plain text.
const INLINE_SAFE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const variant = searchParams.get("variant") === "thumb" ? "thumb" : "original";

    const session = await requireSession();
    if (variant !== "thumb") {
      const { allowed, retryAfter } = await checkRateLimit(`file-content:${session.user.id}`, {
        windowSeconds: 60,
        max: 120,
      });
      if (!allowed) return rateLimitedResponse(retryAfter!);
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const [fRecord] = await db.select().from(file).where(eq(file.id, id)).limit(1);
    if (!fRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    if (!(await canAccessFile(session.user.id, fRecord))) {
      throw new ServiceError(403, "Forbidden");
    }
    const rangeHeader = request.headers.get("range");
    if (variant === "original" && (!rangeHeader || rangeHeader.startsWith("bytes=0-") || rangeHeader.startsWith("bytes=-"))) {
      void recordAudit({
        workspaceId: fRecord.workspaceId,
        actorId: session.user.id,
        action: "file.download",
        targetType: "file",
        targetId: fRecord.id,
        metadata: { name: fRecord.name },
      });
    }

    const isThumb = variant === "thumb";
    const thumbnailKey = fRecord.thumbnailKey;
    if (isThumb && !thumbnailKey) {
      return NextResponse.json({ error: "Thumbnail not available" }, { status: 404 });
    }

    const isSafeInline = INLINE_SAFE_MIME_TYPES.has(fRecord.mimeType);
    const contentType = isThumb ? "image/webp" : isSafeInline ? fRecord.mimeType : "application/octet-stream";
    const disposition = isThumb || isSafeInline ? "inline" : "attachment";
    const storageKey = isThumb ? thumbnailKey : fRecord.storageKey;
    if (!storageKey) {
      return NextResponse.json({ error: "Storage file unreadable" }, { status: 500 });
    }

    try {
      return await storedObjectResponse(storageKey, {
        contentType,
        filename: isThumb ? `${fRecord.name}.thumb.webp` : fRecord.name,
        disposition,
        totalSize: isThumb ? 0 : fRecord.size,
        rangeHeader: isThumb ? null : rangeHeader,
      });
    } catch (s3Error) {
      console.warn("MinIO stream warning:", s3Error);
      return NextResponse.json({ error: "Storage file unreadable" }, { status: 500 });
    }
  } catch (error) {
    return jsonError(error, "Failed to load file content");
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : null;
    const content = typeof body.content === "string" ? body.content : null;
    if (!id || content === null) {
      return NextResponse.json({ error: "Missing id or content" }, { status: 400 });
    }
    const updated = await writeFileContent(ctx, id, content);
    return NextResponse.json({
      id: updated.id,
      size: updated.size,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    return jsonError(error, "Failed to save file");
  }
}
