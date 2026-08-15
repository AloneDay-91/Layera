import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { transferItem } from "@/lib/services/files";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id, type, targetWorkspaceId, targetFolderId } = await request.json();
    if (!id || (type !== "file" && type !== "folder") || !targetWorkspaceId) {
      return NextResponse.json({ error: "Missing id, type or target workspace" }, { status: 400 });
    }
    const item = await transferItem(ctx, { id, type, targetWorkspaceId, targetFolderId });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError(error, "Failed to transfer item");
  }
}
