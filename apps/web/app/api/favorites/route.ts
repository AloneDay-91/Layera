import { NextResponse } from "next/server";
import { db, folder, file, favorite, eq, and, inArray } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { hiddenItemIds } from "@/lib/services/hidden";
import { usersByIds } from "@/lib/services/users";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const wsRecord = ctx.workspace;

    const favoriteRows = await db
      .select()
      .from(favorite)
      .where(and(eq(favorite.workspaceId, wsRecord.id), eq(favorite.userId, ctx.actor.id)));

    if (favoriteRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const hiddenIds = await hiddenItemIds(wsRecord.id);

    const fileIds = favoriteRows.filter((f) => f.itemType === "file").map((f) => f.itemId);
    const folderIds = favoriteRows.filter((f) => f.itemType === "folder").map((f) => f.itemId);

    const [favFiles, favFolders, allFolders] = await Promise.all([
      fileIds.length > 0
        ? db.select().from(file).where(and(inArray(file.id, fileIds), eq(file.workspaceId, wsRecord.id)))
        : Promise.resolve([]),
      folderIds.length > 0
        ? db.select().from(folder).where(and(inArray(folder.id, folderIds), eq(folder.workspaceId, wsRecord.id)))
        : Promise.resolve([]),
      db.select().from(folder).where(eq(folder.workspaceId, wsRecord.id)),
    ]);

    const folderNameById = new Map(allFolders.map((f) => [f.id, f.name === "root" ? "Mes fichiers" : f.name]));
    const favoriteMeta = new Map(
      favoriteRows.map((f) => [f.itemId, { favoritedAt: f.createdAt.toISOString(), pinned: f.pinned }]),
    );
    const owners = await usersByIds([...favFiles.map((f) => f.createdBy), ...favFolders.map((f) => f.createdBy)]);

    const fileItems = favFiles
      .filter((f) => !hiddenIds.has(f.id))
      .map((f) => ({
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
        isFavorite: true,
        isPinned: favoriteMeta.get(f.id)?.pinned ?? false,
        favoritedAt: favoriteMeta.get(f.id)?.favoritedAt ?? f.updatedAt.toISOString(),
      }));

    const folderItems = favFolders
      .filter((f) => !hiddenIds.has(f.id))
      .map((f) => ({
        id: f.id,
        parentId: f.parentId,
        type: "folder" as const,
        name: f.name,
        mimeType: null,
        size: null,
        updatedAt: f.updatedAt.toISOString(),
        owner: (f.createdBy && owners.get(f.createdBy)?.name) || ctx.actor.name,
        ownerId: f.createdBy ?? ctx.actor.id,
        location: f.parentId ? (folderNameById.get(f.parentId) ?? "Mes fichiers") : "Mes fichiers",
        isFavorite: true,
        isPinned: favoriteMeta.get(f.id)?.pinned ?? false,
        favoritedAt: favoriteMeta.get(f.id)?.favoritedAt ?? f.updatedAt.toISOString(),
      }));

    const items = [...folderItems, ...fileItems].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.favoritedAt.localeCompare(a.favoritedAt);
    });

    return NextResponse.json({ items });
  } catch (error) {
    return jsonError(error, "Failed to fetch favorites");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const wsRecord = ctx.workspace;

    const { id, type } = await request.json();
    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid id/type" }, { status: 400 });
    }

    const belongsToWorkspace =
      type === "file"
        ? await db.select({ id: file.id }).from(file).where(and(eq(file.id, id), eq(file.workspaceId, wsRecord.id))).limit(1)
        : await db.select({ id: folder.id }).from(folder).where(and(eq(folder.id, id), eq(folder.workspaceId, wsRecord.id))).limit(1);

    if (!belongsToWorkspace[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(favorite)
      .where(and(eq(favorite.userId, ctx.actor.id), eq(favorite.itemId, id)))
      .limit(1);

    if (existing[0]) {
      await db.delete(favorite).where(eq(favorite.id, existing[0].id));
      return NextResponse.json({ favorited: false });
    }

    await db.insert(favorite).values({
      workspaceId: wsRecord.id,
      userId: ctx.actor.id,
      itemType: type,
      itemId: id,
    });
    return NextResponse.json({ favorited: true });
  } catch (error) {
    return jsonError(error, "Failed to toggle favorite");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id, pinned } = await request.json();
    if (!id || typeof pinned !== "boolean") {
      return NextResponse.json({ error: "Missing id or pinned" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(favorite)
      .where(and(eq(favorite.userId, ctx.actor.id), eq(favorite.itemId, id), eq(favorite.workspaceId, ctx.workspace.id)))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }

    await db
      .update(favorite)
      .set({ pinned, pinnedAt: pinned ? new Date() : null })
      .where(eq(favorite.id, existing.id));
    return NextResponse.json({ pinned });
  } catch (error) {
    return jsonError(error, "Failed to pin favorite");
  }
}
