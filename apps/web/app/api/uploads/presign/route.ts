import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { presignUpload } from "@/lib/services/uploads";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { allowed, retryAfter } = await checkRateLimit(`upload:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 30,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const body = await request.json();
    const result = await presignUpload(ctx, {
      name: body.name,
      size: body.size,
      mimeType: body.mimeType,
      folderId: body.folderId ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to presign upload");
  }
}
