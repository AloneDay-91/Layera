import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorizedWorkspace, requireSession, WORKSPACE_COOKIE } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { listAccessibleWorkspaces } from "@/lib/services/members";
import { requireWorkspaceMember } from "@filecloud/db";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const workspaces = await listAccessibleWorkspaces(ctx.actor.id);
    return NextResponse.json({
      workspaces,
      activeWorkspaceId: ctx.workspace.id,
    });
  } catch (error) {
    return jsonError(error, "Failed to list workspaces");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { workspaceId } = await request.json();
    if (!workspaceId || typeof workspaceId !== "string") {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }
    await requireWorkspaceMember(session.user.id, workspaceId);
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return NextResponse.json({ success: true, workspaceId });
  } catch (error) {
    return jsonError(error, "Failed to switch workspace");
  }
}
