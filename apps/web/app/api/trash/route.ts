import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { listTrashedItems, restoreTrashedItem, emptyTrash, permanentlyDeleteTrashedItem } from "@/lib/services/trash";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const items = await listTrashedItems(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch trashed items");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id, type } = await request.json();
    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }
    await restoreTrashedItem(ctx, { id, type });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to restore item");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    const emptyAll = searchParams.get("empty") === "true";

    if (emptyAll) {
      await emptyTrash(ctx);
      return NextResponse.json({ success: true });
    }

    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    await permanentlyDeleteTrashedItem(ctx, { id, type });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to delete item permanently");
  }
}
