import { NextResponse } from "next/server";
import { db, file, eq } from "@filecloud/db";
import { requireSession } from "@/lib/services/permissions";
import { canAccessFile } from "@/lib/services/item-shares";
import { jsonError } from "@/lib/services/http";
import { ServiceError } from "@/lib/services/errors";
import { signedOrProxyReadUrl } from "@/lib/services/signed-read";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { allowed, retryAfter } = await checkRateLimit(`file-signed:${session.user.id}`, {
      windowSeconds: 60,
      max: 120,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const variant = searchParams.get("variant") === "thumb" ? "thumb" : "original";
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

    const storageKey = variant === "thumb" ? fRecord.thumbnailKey : fRecord.storageKey;
    if (!storageKey) {
      return NextResponse.json({ error: "Preview not available" }, { status: 404 });
    }

    const proxyPath = `/api/files/content?id=${encodeURIComponent(id)}${variant === "thumb" ? "&variant=thumb" : ""}`;
    const descriptor =
      variant === "thumb"
        ? { mimeType: "image/webp", name: `${fRecord.name}.thumb.webp` }
        : { mimeType: fRecord.mimeType, name: fRecord.name };
    const signed = await signedOrProxyReadUrl(storageKey, proxyPath, descriptor);
    return NextResponse.json(signed);
  } catch (error) {
    return jsonError(error, "Failed to sign file URL");
  }
}
