import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, folder, file, trashItem, eq, and, isNull } from "@filecloud/db";

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
      .select()
      .from(trashItem)
      .where(eq(trashItem.workspaceId, wsRecord.id));

    const resultItems = [];

    for (const tRow of trashedRows) {
      if (tRow.itemType === "file") {
        const [fRecord] = await db
          .select()
          .from(file)
          .where(eq(file.id, tRow.itemId))
          .limit(1);
        if (fRecord) {
          resultItems.push({
            id: fRecord.id,
            trashId: tRow.id,
            type: "file" as const,
            name: fRecord.name,
            size: fRecord.size,
            mimeType: fRecord.mimeType,
            deletedAt: tRow.deletedAt.toISOString(),
            purgeAt: tRow.purgeAt.toISOString(),
            owner: session.user.name,
          });
        }
      } else {
        const [fldRecord] = await db
          .select()
          .from(folder)
          .where(eq(folder.id, tRow.itemId))
          .limit(1);
        if (fldRecord) {
          resultItems.push({
            id: fldRecord.id,
            trashId: tRow.id,
            type: "folder" as const,
            name: fldRecord.name,
            size: null,
            mimeType: null,
            deletedAt: tRow.deletedAt.toISOString(),
            purgeAt: tRow.purgeAt.toISOString(),
            owner: session.user.name,
          });
        }
      }
    }

    return NextResponse.json({ items: resultItems });
  } catch (error) {
    console.error("[GET /api/trash Error]:", error);
    return NextResponse.json({ error: "Failed to fetch trashed items" }, { status: 500 });
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

    const { id, type } = await request.json();

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    // Restaurer l'élément : supprimer de trashItem
    await db.delete(trashItem).where(eq(trashItem.itemId, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/trash Error]:", error);
    return NextResponse.json({ error: "Failed to restore item" }, { status: 500 });
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
    const emptyAll = searchParams.get("empty") === "true";

    if (emptyAll) {
      // Vider toute la corbeille de l'espace actif
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
        const trashedRows = await db
          .select()
          .from(trashItem)
          .where(eq(trashItem.workspaceId, wsRecord.id));

        for (const tRow of trashedRows) {
          if (tRow.itemType === "file") {
            await db.delete(file).where(eq(file.id, tRow.itemId));
          } else {
            await db.delete(folder).where(eq(folder.id, tRow.itemId));
          }
        }
        await db.delete(trashItem).where(eq(trashItem.workspaceId, wsRecord.id));
      }

      return NextResponse.json({ success: true });
    }

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    // Supprimer définitivement
    await db.delete(trashItem).where(eq(trashItem.itemId, id));
    if (type === "file") {
      await db.delete(file).where(eq(file.id, id));
    } else {
      await db.delete(folder).where(eq(folder.id, id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/trash Error]:", error);
    return NextResponse.json({ error: "Failed to delete item permanently" }, { status: 500 });
  }
}
