import { NextResponse } from "next/server";
import { minioClient, S3_BUCKET } from "@filecloud/storage";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { getFileInWorkspace } from "@/lib/services/files";
import { jsonError } from "@/lib/services/http";

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
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const fRecord = await getFileInWorkspace(ctx.workspace.id, id);

    const isSafeInline = INLINE_SAFE_MIME_TYPES.has(fRecord.mimeType);
    const contentType = isSafeInline ? fRecord.mimeType : "application/octet-stream";
    const disposition = isSafeInline ? "inline" : "attachment";
    const baseHeaders = {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fRecord.name)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Accept-Ranges": "bytes",
    };

    try {
      const rangeHeader = request.headers.get("range");
      const totalSize = fRecord.size;

      if (rangeHeader && totalSize > 0) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        const rangeStart = match?.[1] ? parseInt(match[1], 10) : 0;
        const rangeEnd = match?.[2] ? parseInt(match[2], 10) : totalSize - 1;

        if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd) || rangeStart > rangeEnd || rangeStart >= totalSize) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${totalSize}` },
          });
        }

        const clampedEnd = Math.min(rangeEnd, totalSize - 1);
        const chunkLength = clampedEnd - rangeStart + 1;

        const stream = await minioClient.getPartialObject(S3_BUCKET, fRecord.storageKey, rangeStart, chunkLength);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }

        return new NextResponse(Buffer.concat(chunks), {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${rangeStart}-${clampedEnd}/${totalSize}`,
            "Content-Length": chunkLength.toString(),
          },
        });
      }

      const stream = await minioClient.getObject(S3_BUCKET, fRecord.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      return new NextResponse(fileBuffer, { headers: baseHeaders });
    } catch (s3Error) {
      console.warn("MinIO stream warning:", s3Error);
      return NextResponse.json({ error: "Storage file unreadable" }, { status: 500 });
    }
  } catch (error) {
    return jsonError(error, "Failed to load file content");
  }
}
