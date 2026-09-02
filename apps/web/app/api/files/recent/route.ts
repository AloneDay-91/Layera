import { NextResponse } from "next/server";
import { db, folder, file, eq, and, desc } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { notHidden } from "@/lib/services/hidden";
import { usersByIds } from "@/lib/services/users";
import { previewUrlsByFileId } from "@/lib/services/signed-read";

const RECENT_LIMIT = 30;

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const workspaceId = ctx.workspace.id;

    const recentFiles = await db
      .select({
        id: file.id,
        folderId: file.folderId,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        updatedAt: file.updatedAt,
        createdBy: file.createdBy,
        storageKey: file.storageKey,
        thumbnailKey: file.thumbnailKey,
        folderName: folder.name,
      })
      .from(file)
      .leftJoin(folder, eq(folder.id, file.folderId))
      .where(and(eq(file.workspaceId, workspaceId), notHidden(file.id, workspaceId)))
      .orderBy(desc(file.updatedAt))
      .limit(RECENT_LIMIT);

    const [owners, previewUrls] = await Promise.all([
      usersByIds(recentFiles.map((f) => f.createdBy)),
      previewUrlsByFileId(recentFiles),
    ]);

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
      location: f.folderName && f.folderName !== "root" ? f.folderName : "Mes fichiers",
      hasThumbnail: Boolean(f.thumbnailKey),
      thumbnailUrl: previewUrls.get(f.id),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch recent files");
  }
}
