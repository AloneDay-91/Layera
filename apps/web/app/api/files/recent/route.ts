import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  db,
  workspace,
  folder,
  file,
  trashItem,
  eq,
  and,
  isNull,
  notInArray,
  desc,
} from "@filecloud/db";

const RECENT_LIMIT = 30;

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeOrgId = session.session.activeOrganizationId;
    let wsRecord;
    if (activeOrgId) {
      const found = await db
        .select()
        .from(workspace)
        .where(eq(workspace.organizationId, activeOrgId))
        .limit(1);
      wsRecord = found[0];
    } else {
      const found = await db
        .select()
        .from(workspace)
        .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
        .limit(1);
      wsRecord = found[0];
    }

    if (!wsRecord) {
      return NextResponse.json({ items: [] });
    }

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = trashedRows.map((t) => t.itemId);

    const recentFiles = await db
      .select()
      .from(file)
      .where(
        trashedIds.length > 0
          ? and(eq(file.workspaceId, wsRecord.id), notInArray(file.id, trashedIds))
          : eq(file.workspaceId, wsRecord.id),
      )
      .orderBy(desc(file.updatedAt))
      .limit(RECENT_LIMIT);

    const folderIds = [...new Set(recentFiles.map((f) => f.folderId))];
    const folders = folderIds.length > 0 ? await db.select().from(folder).where(eq(folder.workspaceId, wsRecord.id)) : [];
    const folderNameById = new Map(folders.map((f) => [f.id, f.name === "root" ? "Mes fichiers" : f.name]));

    const items = recentFiles.map((f) => ({
      id: f.id,
      parentId: f.folderId,
      type: "file" as const,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt.toISOString(),
      owner: session.user.name,
      location: folderNameById.get(f.folderId) ?? "Mes fichiers",
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/files/recent Error]:", error);
    return NextResponse.json({ error: "Failed to fetch recent files" }, { status: 500 });
  }
}
