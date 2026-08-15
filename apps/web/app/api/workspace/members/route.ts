import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { inviteWorkspaceMember, listWorkspaceMembers, removeWorkspaceMember } from "@/lib/services/members";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const members = await listWorkspaceMembers(ctx);
    return NextResponse.json({
      members,
      role: ctx.role,
      canManage: ctx.role === "owner",
      workspaceId: ctx.workspace.id,
      workspaceName: ctx.workspace.name,
    });
  } catch (error) {
    return jsonError(error, "Failed to list members");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const member = await inviteWorkspaceMember(ctx, email);
    return NextResponse.json({ member });
  } catch (error) {
    return jsonError(error, "Failed to invite member");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    await removeWorkspaceMember(ctx, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to remove member");
  }
}
