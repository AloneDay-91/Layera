import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, favorite, trashItem, eq, and, isNull, inArray } from "@filecloud/db";

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

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ items: [] });
    }

    const favoriteRows = await db
      .select()
      .from(favorite)
      .where(and(eq(favorite.workspaceId, wsRecord.id), eq(favorite.userId, session.user.id)));

    if (favoriteRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = new Set(trashedRows.map((t) => t.itemId));

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
    const favoritedAtByItemId = new Map(favoriteRows.map((f) => [f.itemId, f.createdAt.toISOString()]));

    const fileItems = favFiles
      .filter((f) => !trashedIds.has(f.id))
      .map((f) => ({
        id: f.id,
        parentId: f.folderId,
        type: "file" as const,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        updatedAt: f.updatedAt.toISOString(),
        owner: session.user.name,
        location: folderNameById.get(f.folderId) ?? "Mes fichiers",
        isFavorite: true,
        favoritedAt: favoritedAtByItemId.get(f.id) ?? f.updatedAt.toISOString(),
      }));

    const folderItems = favFolders
      .filter((f) => !trashedIds.has(f.id))
      .map((f) => ({
        id: f.id,
        parentId: f.parentId,
        type: "folder" as const,
        name: f.name,
        mimeType: null,
        size: null,
        updatedAt: f.updatedAt.toISOString(),
        owner: session.user.name,
        location: f.parentId ? (folderNameById.get(f.parentId) ?? "Mes fichiers") : "Mes fichiers",
        isFavorite: true,
        favoritedAt: favoritedAtByItemId.get(f.id) ?? f.updatedAt.toISOString(),
      }));

    const items = [...folderItems, ...fileItems].sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/favorites Error]:", error);
    return NextResponse.json({ error: "Failed to fetch favorites" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, type } = await request.json();
    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing or invalid id/type" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
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
      .where(and(eq(favorite.userId, session.user.id), eq(favorite.itemId, id)))
      .limit(1);

    if (existing[0]) {
      await db.delete(favorite).where(eq(favorite.id, existing[0].id));
      return NextResponse.json({ favorited: false });
    }

    await db.insert(favorite).values({
      workspaceId: wsRecord.id,
      userId: session.user.id,
      itemType: type,
      itemId: id,
    });
    return NextResponse.json({ favorited: true });
  } catch (error) {
    console.error("[POST /api/favorites Error]:", error);
    return NextResponse.json({ error: "Failed to toggle favorite" }, { status: 500 });
  }
}
