import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, requireSession } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import {
  createItemShare,
  listItemSharesForItem,
  listSharedWithMe,
  revokeItemShare,
} from "@/lib/services/item-shares";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const mine = searchParams.get("mine") === "true";

    if (mine) {
      const session = await requireSession();
      const items = await listSharedWithMe(session.user.id);
      return NextResponse.json({ items });
    }

    const ctx = await getAuthorizedWorkspace();
    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }
    const shares = await listItemSharesForItem(ctx, itemId);
    return NextResponse.json({ shares });
  } catch (error) {
    return jsonError(error, "Failed to list shares");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    // Resolving a share target by email reports whether an account exists, so
    // throttle it rather than leaving an enumeration oracle wide open.
    const { allowed, retryAfter } = await checkRateLimit(`item-share:${ctx.actor.id}`, {
      windowSeconds: 60,
      max: 20,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { itemId, itemType, email, userId } = await request.json();
    if (!itemId || (itemType !== "file" && itemType !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid item" }, { status: 400 });
    }
    const share = await createItemShare(ctx, { itemId, itemType, email, userId });
    return NextResponse.json({ share });
  } catch (error) {
    return jsonError(error, "Failed to share item");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await revokeItemShare(ctx, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to revoke share");
  }
}
