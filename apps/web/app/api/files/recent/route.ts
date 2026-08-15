import { NextResponse } from "next/server";
import { db, folder, file, trashItem, eq, and, notInArray, desc } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";

const RECENT_LIMIT = 30;

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const workspaceId = ctx.workspace.id;

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, workspaceId));
    const trashedIds = trashedRows.map((t) => t.itemId);

    const recentFiles = await db
      .select()
      .from(file)
      .where(
        trashedIds.length > 0
          ? and(eq(file.workspaceId, workspaceId), notInArray(file.id, trashedIds))
          : eq(file.workspaceId, workspaceId),
      )
      .orderBy(desc(file.updatedAt))
      .limit(RECENT_LIMIT);

    const folders = await db.select().from(folder).where(eq(folder.workspaceId, workspaceId));
    const folderNameById = new Map(folders.map((f) => [f.id, f.name === "root" ? "Mes fichiers" : f.name]));

    const items = recentFiles.map((f) => ({
      id: f.id,
      parentId: f.folderId,
      type: "file" as const,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt.toISOString(),
      owner: ctx.actor.name,
      location: folderNameById.get(f.folderId) ?? "Mes fichiers",
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch recent files");
  }
}
