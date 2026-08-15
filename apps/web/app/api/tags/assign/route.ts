import { NextResponse } from "next/server";
import { db, tag, itemTag, file, folder, eq, and } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { tagId, itemId, itemType } = await request.json();
    if (!tagId || !itemId || (itemType !== "file" && itemType !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid tagId/itemId/itemType" }, { status: 400 });
    }

    const wsRecord = ctx.workspace;

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
    return jsonError(error, "Failed to assign tag");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");
    const itemId = searchParams.get("itemId");
    if (!tagId || !itemId) {
      return NextResponse.json({ error: "Missing tagId/itemId" }, { status: 400 });
    }

    await db
      .delete(itemTag)
      .where(and(eq(itemTag.tagId, tagId), eq(itemTag.itemId, itemId), eq(itemTag.workspaceId, ctx.workspace.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to unassign tag");
  }
}
