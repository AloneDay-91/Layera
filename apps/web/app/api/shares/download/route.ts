import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, shareLink, file, eq } from "@filecloud/db";
import { minioClient, S3_BUCKET } from "@filecloud/storage";
import { shareUnlockCookieName, verifyShareUnlock } from "@/lib/share-unlock";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/services/audit";

export async function GET(request: Request) {
  try {
    const { allowed, retryAfter } = await checkRateLimit(`share-download:${getClientIp(request)}`, {
      windowSeconds: 60,
      max: 30,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const [sRecord] = await db
      .select()
      .from(shareLink)
      .where(eq(shareLink.token, token))
      .limit(1);

    if (
      !sRecord ||
      sRecord.revokedAt ||
      !sRecord.fileId ||
      (sRecord.expiresAt && sRecord.expiresAt < new Date())
    ) {
      return NextResponse.json({ error: "Share link invalid or expired" }, { status: 404 });
    }

    if (sRecord.passwordHash) {
      const cookieStore = await cookies();
      const unlocked = verifyShareUnlock(token, cookieStore.get(shareUnlockCookieName(token))?.value);
      if (!unlocked) {
        return NextResponse.json({ error: "Password required" }, { status: 401 });
      }
    }

    const [fRecord] = await db
      .select()
      .from(file)
      .where(eq(file.id, sRecord.fileId))
      .limit(1);

    if (!fRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      const stream = await minioClient.getObject(S3_BUCKET, fRecord.storageKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      void recordAudit({
        workspaceId: sRecord.workspaceId,
        actorId: sRecord.createdBy,
        action: "share.download",
        targetType: "file",
        targetId: fRecord.id,
        metadata: { name: fRecord.name, public: true },
      });

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": fRecord.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fRecord.name)}"`,
        },
      });
    } catch (s3Error) {
      console.warn("MinIO stream warning:", s3Error);
      return NextResponse.json({ error: "Storage file unreadable" }, { status: 500 });
    }
  } catch (error) {
    console.error("[GET /api/shares/download Error]:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
