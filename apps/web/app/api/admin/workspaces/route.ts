import { NextResponse } from "next/server";
import { db, workspace, user, organization, member, file, eq, inArray, sql } from "@filecloud/db";
import { getAdminSession } from "@/lib/require-admin";
import { deleteWorkspaceStoredFiles } from "@/lib/services/storage-cleanup";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const workspaces = await db.select().from(workspace);

    const ownerIds = [...new Set(workspaces.map((w) => w.ownerId))];
    const owners = ownerIds.length > 0 ? await db.select().from(user).where(inArray(user.id, ownerIds)) : [];
    const ownerById = new Map(owners.map((o) => [o.id, o]));

    const orgIds = [...new Set(workspaces.map((w) => w.organizationId).filter((id): id is string => id !== null))];
    const orgs = orgIds.length > 0 ? await db.select().from(organization).where(inArray(organization.id, orgIds)) : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    const memberCounts = new Map<string, number>();
    if (orgIds.length > 0) {
      const members = await db.select({ organizationId: member.organizationId }).from(member).where(inArray(member.organizationId, orgIds));
      for (const m of members) {
        memberCounts.set(m.organizationId, (memberCounts.get(m.organizationId) ?? 0) + 1);
      }
    }

    const workspaceIds = workspaces.map((w) => w.id);
    const storageByWorkspace = new Map<string, number>();
    if (workspaceIds.length > 0) {
      const sums = await db
        .select({
          workspaceId: file.workspaceId,
          used: sql<number>`coalesce(sum(${file.size}), 0)`,
        })
        .from(file)
        .where(inArray(file.workspaceId, workspaceIds))
        .groupBy(file.workspaceId);
      for (const row of sums) {
        storageByWorkspace.set(row.workspaceId, Number(row.used ?? 0));
      }
    }

    const result = workspaces.map((w) => {
      const owner = ownerById.get(w.ownerId);
      const org = w.organizationId ? orgById.get(w.organizationId) : undefined;
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        ownerName: owner?.name ?? "Utilisateur supprimé",
        ownerEmail: owner?.email ?? "",
        organizationName: org?.name ?? null,
        memberCount: w.organizationId ? (memberCounts.get(w.organizationId) ?? 0) : 1,
        storageBytes: storageByWorkspace.get(w.id) ?? 0,
        createdAt: w.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ workspaces: result });
  } catch (error) {
    console.error("[GET /api/admin/workspaces Error]:", error);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await deleteWorkspaceStoredFiles(id);
    await db.delete(workspace).where(eq(workspace.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/workspaces Error]:", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
