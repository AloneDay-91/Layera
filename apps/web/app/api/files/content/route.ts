import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, file, eq, and, isNull } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";

// SVG is deliberately excluded — it can embed <script> and executes it when
// navigated to directly (Content-Disposition: inline), unlike raster formats.
const INLINE_SAFE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const [fRecord] = await db.select().from(file).where(eq(file.id, id)).limit(1);

    if (!fRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const activeOrgId = session.session.activeOrganizationId;
    let wsRecord;
    if (activeOrgId) {
      const found = await db
        .select()
        .from(workspace)
        .where(eq(workspace.organizationId, activeOrgId))
        .limit(1);
      wsRecord = found[0];
    } else {
      const found = await db
        .select()
        .from(workspace)
        .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
        .limit(1);
      wsRecord = found[0];
    }

    if (!wsRecord || fRecord.workspaceId !== wsRecord.id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      const stream = await minioClient.getObject(S3_BUCKET, fRecord.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      const isSafeInline = INLINE_SAFE_MIME_TYPES.has(fRecord.mimeType);
      const contentType = isSafeInline ? fRecord.mimeType : "application/octet-stream";
      const disposition = isSafeInline ? "inline" : "attachment";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fRecord.name)}"`,
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (s3Error) {
      console.warn("MinIO stream warning:", s3Error);
      return NextResponse.json({ error: "Storage file unreadable" }, { status: 500 });
    }
  } catch (error) {
    console.error("[GET /api/files/content Error]:", error);
    return NextResponse.json({ error: "Failed to load file content" }, { status: 500 });
  }
}
