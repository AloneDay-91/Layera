import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, shareLink, file, eq } from "@filecloud/db";
import { shareUnlockCookieName, verifyShareUnlock } from "@/lib/share-unlock";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/services/audit";
import { storedObjectResponse, contentDisposition } from "@/lib/http-file";
import { presignGetObject, usesPublicPresign } from "@filecloud/storage";
import { SIGNED_GET_EXPIRY_SECONDS } from "@/lib/services/signed-read";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Per-link as well as per-IP: without a trusted proxy every visitor looks
    // like the same client, and one popular link must not exhaust the budget
    // of every other link on the instance.
    for (const key of [`share-download:${token}`, `share-download:${getClientIp(request)}`]) {
      const { allowed, retryAfter } = await checkRateLimit(key, { windowSeconds: 60, max: 30 });
      if (!allowed) return rateLimitedResponse(retryAfter!);
    }

    const [sRecord] = await db.select().from(shareLink).where(eq(shareLink.token, token)).limit(1);

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
      const unlocked = verifyShareUnlock(
        token,
        sRecord.passwordHash,
        cookieStore.get(shareUnlockCookieName(token))?.value,
      );
      if (!unlocked) {
        return NextResponse.json({ error: "Password required" }, { status: 401 });
      }
    }

    const [fRecord] = await db.select().from(file).where(eq(file.id, sRecord.fileId)).limit(1);

    if (!fRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    try {
      void recordAudit({
        workspaceId: sRecord.workspaceId,
        actorId: sRecord.createdBy,
        action: "share.download",
        targetType: "file",
        targetId: fRecord.id,
        metadata: { name: fRecord.name, public: true },
      });

      if (usesPublicPresign) {
        const url = await presignGetObject(fRecord.storageKey, SIGNED_GET_EXPIRY_SECONDS, {
          // Signed alongside the URL, so the client cannot have the object
          // served back under the type it chose when it uploaded the bytes.
          "response-content-type": "application/octet-stream",
          "response-content-disposition": contentDisposition("attachment", fRecord.name),
        });
        return NextResponse.redirect(url, 302);
      }

      return await storedObjectResponse(fRecord.storageKey, {
        contentType: fRecord.mimeType || "application/octet-stream",
        filename: fRecord.name,
        disposition: "attachment",
        totalSize: fRecord.size,
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
