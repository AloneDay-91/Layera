import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import {
  listArchivedItems,
  archiveItemInWorkspace,
  restoreArchivedItem,
  permanentlyDeleteArchivedItem,
} from "@/lib/services/archive";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const items = await listArchivedItems(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch archived items");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const body = await request.json();
    const { id, type, restore } = body;
    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid id/type" }, { status: 400 });
    }
    if (restore) {
      await restoreArchivedItem(ctx, { id, type });
    } else {
      await archiveItemInWorkspace(ctx, { id, type });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to update archive");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid id/type" }, { status: 400 });
    }
    await permanentlyDeleteArchivedItem(ctx, { id, type });
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to delete archived item");
  }
}
