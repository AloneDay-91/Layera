import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, workspace, tag, itemTag, TAG_COLORS, eq, and, isNull } from "@filecloud/db";
import type { TagColor } from "@filecloud/db";

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
      return NextResponse.json({ tags: [] });
    }

    const tags = await db.select().from(tag).where(eq(tag.workspaceId, wsRecord.id)).orderBy(tag.name);

    const assignments = await db
      .select({ tagId: itemTag.tagId })
      .from(itemTag)
      .where(eq(itemTag.workspaceId, wsRecord.id));
    const countByTagId = new Map<string, number>();
    for (const row of assignments) {
      countByTagId.set(row.tagId, (countByTagId.get(row.tagId) ?? 0) + 1);
    }

    return NextResponse.json({
      tags: tags.map((t) => ({ ...t, itemCount: countByTagId.get(t.id) ?? 0 })),
    });
  } catch (error) {
    console.error("[GET /api/tags Error]:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color } = await request.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const tagColor = TAG_COLORS.includes(color) ? color : "neutral";

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(tag)
      .where(and(eq(tag.workspaceId, wsRecord.id), eq(tag.name, trimmedName)))
      .limit(1);
    if (existing[0]) {
      return NextResponse.json({ error: "A tag with this name already exists" }, { status: 409 });
    }

    const [created] = await db
      .insert(tag)
      .values({ workspaceId: wsRecord.id, name: trimmedName, color: tagColor })
      .returning();

    return NextResponse.json({ tag: created });
  } catch (error) {
    console.error("[POST /api/tags Error]:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, color } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing tag id" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(tag)
      .where(and(eq(tag.id, id), eq(tag.workspaceId, wsRecord.id)))
      .limit(1);
    if (!existing[0]) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const updates: Partial<{ name: string; color: TagColor }> = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (TAG_COLORS.includes(color)) updates.color = color as TagColor;

    const [updated] = await db.update(tag).set(updates).where(eq(tag.id, id)).returning();
    return NextResponse.json({ tag: updated });
  } catch (error) {
    console.error("[PATCH /api/tags Error]:", error);
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing tag id" }, { status: 400 });
    }

    const wsRecord = await getActiveWorkspace(session);
    if (!wsRecord) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    await db.delete(tag).where(and(eq(tag.id, id), eq(tag.workspaceId, wsRecord.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/tags Error]:", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}
