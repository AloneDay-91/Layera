import { NextResponse } from "next/server";
import { db, workspace, eq } from "@filecloud/db";
import { getAdminSession, getWorkspaceAdminSession } from "@/lib/require-admin";
import { jsonError } from "@/lib/services/http";
import { listAdminWorkspaces } from "@/lib/services/admin";
import { deleteWorkspaceStoredFiles } from "@/lib/services/storage-cleanup";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const workspaces = await listAdminWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    return jsonError(error, "Failed to fetch workspaces");
  }
}

export async function DELETE(request: Request) {
  const session = await getWorkspaceAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteWorkspaceStoredFiles(id);
    await db.delete(workspace).where(eq(workspace.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/workspaces Error]:", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
