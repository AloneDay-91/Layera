import { NextResponse } from "next/server";
import { db, folder, file, eq, and, notInArray, desc } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { hiddenItemIds } from "@/lib/services/hidden";
import { usersByIds } from "@/lib/services/users";

const RECENT_LIMIT = 30;

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const workspaceId = ctx.workspace.id;

    const hiddenIds = [...(await hiddenItemIds(workspaceId))];

    const recentFiles = await db
      .select()
      .from(file)
      .where(
        hiddenIds.length > 0
          ? and(eq(file.workspaceId, workspaceId), notInArray(file.id, hiddenIds))
          : eq(file.workspaceId, workspaceId),
      )
      .orderBy(desc(file.updatedAt))
      .limit(RECENT_LIMIT);

    const folders = await db.select().from(folder).where(eq(folder.workspaceId, workspaceId));
    const folderNameById = new Map(folders.map((f) => [f.id, f.name === "root" ? "Mes fichiers" : f.name]));
    const owners = await usersByIds(recentFiles.map((f) => f.createdBy));

    const items = recentFiles.map((f) => ({
      id: f.id,
      parentId: f.folderId,
      type: "file" as const,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt.toISOString(),
      owner: (f.createdBy && owners.get(f.createdBy)?.name) || ctx.actor.name,
      ownerId: f.createdBy ?? ctx.actor.id,
      location: folderNameById.get(f.folderId) ?? "Mes fichiers",
      hasThumbnail: Boolean(f.thumbnailKey),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch recent files");
  }
}
