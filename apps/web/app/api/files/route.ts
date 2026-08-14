import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, trashItem, favorite, tag, itemTag, provisionPersonalWorkspace, provisionOrganizationWorkspace, eq, and, isNull, ilike, inArray } from "@filecloud/db";
import { FOLDER_COLOR_OPTIONS } from "@/lib/folder-colors";

const FOLDER_COLOR_VALUES = new Set<string>(FOLDER_COLOR_OPTIONS.map((opt) => opt.value));

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentIdParam = searchParams.get("parentId");
    const searchParam = searchParams.get("search") || searchParams.get("q");

    // 1. Trouver le workspace associé à l'organisation active ou personnel
    const activeOrgId = session.session.activeOrganizationId;

    let wsRecord;
    if (activeOrgId) {
      const found = await db
        .select()
        .from(workspace)
        .where(eq(workspace.organizationId, activeOrgId))
        .limit(1);
      wsRecord = found[0];

      if (!wsRecord) {
        // Provisionner le workspace d'organisation si non existant
        const provisioned = await provisionOrganizationWorkspace({
          organizationId: activeOrgId,
          name: "Workspace Équipe",
          ownerId: session.user.id,
        });
        const created = await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, provisioned.workspaceId))
          .limit(1);
        wsRecord = created[0];
      }
    } else {
      const found = await db
        .select()
        .from(workspace)
        .where(and(eq(workspace.ownerId, session.user.id), isNull(workspace.organizationId)))
        .limit(1);
      wsRecord = found[0];

      if (!wsRecord) {
        const provisioned = await provisionPersonalWorkspace({
          userId: session.user.id,
          userName: session.user.name,
        });
        const created = await db
          .select()
          .from(workspace)
          .where(eq(workspace.id, provisioned.workspaceId))
          .limit(1);
        wsRecord = created[0];
      }
    }

    if (!wsRecord) {
      return NextResponse.json({ items: [] });
    }

    let targetFolderId = parentIdParam;
    let dbFolders;
    let dbFiles;

    if (searchParam) {
      dbFolders = await db
        .select()
        .from(folder)
        .where(and(eq(folder.workspaceId, wsRecord.id), ilike(folder.name, `%${searchParam}%`)));

      dbFiles = await db
        .select()
        .from(file)
        .where(and(eq(file.workspaceId, wsRecord.id), ilike(file.name, `%${searchParam}%`)));
    } else {
      // 2. Trouver le dossier racine si pas de parentId spécifié
      if (!targetFolderId) {
        const rootFolder = await db
          .select()
          .from(folder)
          .where(and(eq(folder.workspaceId, wsRecord.id), isNull(folder.parentId)))
          .limit(1);
        if (rootFolder[0]) {
          targetFolderId = rootFolder[0].id;
        }
      }

      // 3. Récupérer les sous-dossiers
      const folderCondition = targetFolderId
        ? eq(folder.parentId, targetFolderId)
        : isNull(folder.parentId);

      dbFolders = await db
        .select()
        .from(folder)
        .where(and(eq(folder.workspaceId, wsRecord.id), folderCondition));

      // 4. Récupérer les fichiers
      const fileCondition = targetFolderId
        ? eq(file.folderId, targetFolderId)
        : isNull(file.folderId);

      dbFiles = await db
        .select()
        .from(file)
        .where(and(eq(file.workspaceId, wsRecord.id), fileCondition));
    }

    // 5. Récupérer les favoris de l'utilisateur pour cet espace
    const favoriteRows = await db
      .select({ itemId: favorite.itemId })
      .from(favorite)
      .where(and(eq(favorite.workspaceId, wsRecord.id), eq(favorite.userId, session.user.id)));
    const favoriteIds = new Set(favoriteRows.map((f) => f.itemId));

    // 5b. Récupérer les tags des éléments affichés
    const itemIds = [...dbFolders.map((f) => f.id), ...dbFiles.map((f) => f.id)];
    const tagsByItemId = new Map<string, { id: string; name: string; color: string }[]>();
    if (itemIds.length > 0) {
      const tagRows = await db
        .select({ itemId: itemTag.itemId, id: tag.id, name: tag.name, color: tag.color })
        .from(itemTag)
        .innerJoin(tag, eq(itemTag.tagId, tag.id))
        .where(and(eq(itemTag.workspaceId, wsRecord.id), inArray(itemTag.itemId, itemIds)));
      for (const row of tagRows) {
        const list = tagsByItemId.get(row.itemId) ?? [];
        list.push({ id: row.id, name: row.name, color: row.color });
        tagsByItemId.set(row.itemId, list);
      }
    }

    // 5. Transformer au format d'affichage FileBrowser
    const formattedFolders = dbFolders
      .filter((f) => f.name !== "root")
      .map((f) => ({
        id: f.id,
        parentId: f.parentId,
        type: "folder" as const,
        name: f.name,
        mimeType: null,
        size: null,
        updatedAt: f.updatedAt.toISOString(),
        owner: session.user.name,
        isFavorite: favoriteIds.has(f.id),
        tags: tagsByItemId.get(f.id) ?? [],
        color: f.color,
      }));

    const formattedFiles = dbFiles.map((f) => ({
      id: f.id,
      parentId: f.folderId,
      type: "file" as const,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt.toISOString(),
      owner: session.user.name,
      isFavorite: favoriteIds.has(f.id),
      tags: tagsByItemId.get(f.id) ?? [],
    }));

    // 5. Calculer le fil d'Ariane (breadcrumbs)
    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currId = targetFolderId;
    while (currId) {
      const [f] = await db
        .select()
        .from(folder)
        .where(eq(folder.id, currId))
        .limit(1);
      if (!f) break;
      if (f.name !== "root") {
        breadcrumbs.unshift({ id: f.id, name: f.name });
      }
      currId = f.parentId;
    }

    // 6. Exclure les éléments dans la corbeille
    const trashedRows = await db
      .select({ itemId: trashItem.itemId })
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));
    const trashedIds = trashedRows.map((t) => t.itemId);

    const activeFolders = formattedFolders.filter((f) => !trashedIds.includes(f.id));
    const activeFiles = formattedFiles.filter((f) => !trashedIds.includes(f.id));

    return NextResponse.json({
      workspaceId: wsRecord.id,
      currentFolderId: targetFolderId,
      breadcrumbs,
      items: [...activeFolders, ...activeFiles],
    });
  } catch (error) {
    console.error("[API /api/files GET Error]:", error);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, parentId, type, mimeType, size } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Trouver le workspace
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
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Trouver dossier cible
    let targetFolderId = parentId;
    if (!targetFolderId) {
      const rootFolder = await db
        .select()
        .from(folder)
        .where(and(eq(folder.workspaceId, wsRecord.id), isNull(folder.parentId)))
        .limit(1);
      if (rootFolder[0]) {
        targetFolderId = rootFolder[0].id;
      }
    }

    if (type === "folder") {
      const [newFolder] = await db
        .insert(folder)
        .values({
          workspaceId: wsRecord.id,
          parentId: targetFolderId ?? null,
          name,
        })
        .returning();
      return NextResponse.json({ item: newFolder });
    } else {
      const [newFile] = await db
        .insert(file)
        .values({
          workspaceId: wsRecord.id,
          folderId: targetFolderId!,
          name,
          mimeType: mimeType ?? "text/plain",
          size: size ?? 0,
          storageKey: `files/${wsRecord.id}/${Date.now()}-${name}`,
        })
        .returning();
      return NextResponse.json({ item: newFile });
    }
  } catch (error) {
    console.error("[POST /api/files Error]:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, type, name, targetFolderId, color } = await request.json();

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    if (color !== undefined && !FOLDER_COLOR_VALUES.has(color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }

    let resolvedTargetFolderId = targetFolderId;
    if (targetFolderId === null || targetFolderId === "root") {
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

      if (wsRecord) {
        const rootFolder = await db
          .select()
          .from(folder)
          .where(and(eq(folder.workspaceId, wsRecord.id), isNull(folder.parentId)))
          .limit(1);
        if (rootFolder[0]) {
          resolvedTargetFolderId = rootFolder[0].id;
        }
      }
    }

    if (type === "folder") {
      const updateData: { name?: string; parentId?: string; color?: string | null; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (name !== undefined) updateData.name = name;
      if (color !== undefined) updateData.color = color === "default" ? null : color;
      if (resolvedTargetFolderId !== undefined && resolvedTargetFolderId !== null) {
        updateData.parentId = resolvedTargetFolderId;
      }

      const [updated] = await db
        .update(folder)
        .set(updateData)
        .where(eq(folder.id, id))
        .returning();

      return NextResponse.json({ success: true, item: updated });
    } else {
      const updateData: { name?: string; folderId?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (name !== undefined) updateData.name = name;
      if (resolvedTargetFolderId !== undefined && resolvedTargetFolderId !== null) {
        updateData.folderId = resolvedTargetFolderId;
      }

      const [updated] = await db
        .update(file)
        .set(updateData)
        .where(eq(file.id, id))
        .returning();

      return NextResponse.json({ success: true, item: updated });
    }
  } catch (error) {
    console.error("[PATCH /api/files Error]:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    const permanent = searchParams.get("permanent") === "true";

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    if (permanent) {
      if (type === "folder") {
        await db.delete(folder).where(eq(folder.id, id));
      } else {
        await db.delete(file).where(eq(file.id, id));
      }
      await db.delete(trashItem).where(eq(trashItem.itemId, id));
      await db.delete(favorite).where(eq(favorite.itemId, id));
    } else {
      // Soft delete: ajouter à la corbeille (trashItem)
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

      if (wsRecord) {
        const purgeAt = new Date();
        purgeAt.setDate(purgeAt.getDate() + 30);

        await db.insert(trashItem).values({
          workspaceId: wsRecord.id,
          itemType: type as "file" | "folder",
          itemId: id,
          deletedBy: session.user.id,
          purgeAt,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/files Error]:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
