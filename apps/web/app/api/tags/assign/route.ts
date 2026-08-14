import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, tag, itemTag, file, folder, eq, and, isNull } from "@filecloud/db";

async function getActiveWorkspace(session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>) {
  const activeOrgId = session.session.activeOrganizationId;
  if (activeOrgId) {
    const found = await db.select().from(workspace).where(eq(workspace.organizationId, activeOrgId)).limit(1);
    return found[0];
  }
  const found = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
    .limit(1);
  return found[0];
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tagId, itemId, itemType } = await request.json();
    if (!tagId || !itemId || (itemType !== "file" && itemType !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid tagId/itemId/itemType" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const [tagRow] = await db.select().from(tag).where(and(eq(tag.id, tagId), eq(tag.workspaceId, wsRecord.id))).limit(1);
    if (!tagRow) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const itemBelongsToWorkspace =
      itemType === "file"
        ? await db.select({ id: file.id }).from(file).where(and(eq(file.id, itemId), eq(file.workspaceId, wsRecord.id))).limit(1)
        : await db.select({ id: folder.id }).from(folder).where(and(eq(folder.id, itemId), eq(folder.workspaceId, wsRecord.id))).limit(1);
    if (!itemBelongsToWorkspace[0]) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(itemTag)
      .where(and(eq(itemTag.tagId, tagId), eq(itemTag.itemId, itemId)))
      .limit(1);
    if (!existing[0]) {
      await db.insert(itemTag).values({ workspaceId: wsRecord.id, tagId, itemType, itemId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/tags/assign Error]:", error);
    return NextResponse.json({ error: "Failed to assign tag" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");
    const itemId = searchParams.get("itemId");
    if (!tagId || !itemId) {
      return NextResponse.json({ error: "Missing tagId/itemId" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    await db
      .delete(itemTag)
      .where(and(eq(itemTag.tagId, tagId), eq(itemTag.itemId, itemId), eq(itemTag.workspaceId, wsRecord.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tags/assign Error]:", error);
    return NextResponse.json({ error: "Failed to unassign tag" }, { status: 500 });
  }
}
