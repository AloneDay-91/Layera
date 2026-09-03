import { NextResponse } from "next/server";
import { db, tag, itemTag, TAG_COLORS, eq, and } from "@filecloud/db";
import type { TagColor } from "@filecloud/db";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { assertFeatureEnabled } from "@/lib/services/instance-settings";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    await assertFeatureEnabled("tagsEnabled");
    const wsRecord = ctx.workspace;

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
    return jsonError(error, "Failed to fetch tags");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    await assertFeatureEnabled("tagsEnabled");
    const { name, color } = await request.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const tagColor = TAG_COLORS.includes(color) ? color : "neutral";
    const wsRecord = ctx.workspace;

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
    return jsonError(error, "Failed to create tag");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    await assertFeatureEnabled("tagsEnabled");
    const { id, name, color } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing tag id" }, { status: 400 });
    }

    const wsRecord = ctx.workspace;

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
    return jsonError(error, "Failed to update tag");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    await assertFeatureEnabled("tagsEnabled");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing tag id" }, { status: 400 });
    }

    const wsRecord = ctx.workspace;

    await db.delete(tag).where(and(eq(tag.id, id), eq(tag.workspaceId, wsRecord.id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to delete tag");
  }
}
