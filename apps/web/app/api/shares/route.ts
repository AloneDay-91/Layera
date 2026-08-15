import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { listShareLinks, createShareLink, updateShareLink, revokeShareLink } from "@/lib/services/shares";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const shares = await listShareLinks(ctx);
    return NextResponse.json({ shares });
  } catch (error) {
    return jsonError(error, "Failed to fetch share links");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { allowed, retryAfter } = await checkRateLimit(`share-create:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 20,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { itemId, itemType, expiresAt, password } = await request.json();
    if (!itemId || (itemType !== "file" && itemType !== "folder")) {
      return NextResponse.json({ error: "Missing itemId or itemType" }, { status: 400 });
    }

    const share = await createShareLink(ctx, { itemId, itemType, expiresAt, password });
    return NextResponse.json({ success: true, share });
  } catch (error) {
    return jsonError(error, "Failed to create share link");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id, expiresAt, password } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const share = await updateShareLink(ctx, { id, expiresAt, password });
    return NextResponse.json({ success: true, share });
  } catch (error) {
    return jsonError(error, "Failed to update share link");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("id");
    if (!shareId) {
      return NextResponse.json({ error: "Missing shareId" }, { status: 400 });
    }
    await revokeShareLink(ctx, shareId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to revoke share link");
  }
}
