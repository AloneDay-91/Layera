import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { putUploadStream } from "@/lib/services/uploads";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthorizedWorkspace();

    // When MinIO is not reachable from the browser every byte flows through
    // this route, so it needs the same throttle as the presign endpoint.
    const { allowed, retryAfter } = await checkRateLimit(`upload-put:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 60,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { id } = await context.params;
    if (!request.body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const stream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
    await putUploadStream(ctx, id, stream);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error, "Failed to store upload");
  }
}
