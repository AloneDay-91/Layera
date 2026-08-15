import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { completeUpload } from "@/lib/services/uploads";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { allowed, retryAfter } = await checkRateLimit(`upload-complete:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 30,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { uploadId } = await request.json();
    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    }

    const created = await completeUpload(ctx, uploadId);
    return NextResponse.json({ success: true, file: created });
  } catch (error) {
    return jsonError(error, "Failed to complete upload");
  }
}
