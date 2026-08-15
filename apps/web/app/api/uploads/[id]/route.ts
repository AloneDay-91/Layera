import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { putUploadStream } from "@/lib/services/uploads";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id } = await context.params;
    if (!request.body) {
      return NextResponse.json({ error: "Missing body" }, { status: 400 });
    }

    const stream = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
    await putUploadStream(ctx, id, stream, request.headers.get("content-type"));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error, "Failed to store upload");
  }
}
