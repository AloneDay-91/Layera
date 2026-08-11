import { db, workspace, workspaceMember, folder } from "./client";

export async function provisionPersonalWorkspace(input: {
  userId: string;
  userName: string;
}): Promise<{ workspaceId: string; rootFolderId: string }> {
  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspace)
      .values({
        name: `${input.userName}'s Workspace`,
        type: "personal",
        ownerId: input.userId,
      })
      .returning();
    if (!ws) throw new Error("workspace insert returned no row");

    await tx.insert(workspaceMember).values({
      workspaceId: ws.id,
      userId: input.userId,
      role: "owner",
    });

    const [root] = await tx
      .insert(folder)
      .values({
        workspaceId: ws.id,
        parentId: null,
        name: "root",
      })
      .returning();
    if (!root) throw new Error("folder insert returned no row");

    return { workspaceId: ws.id, rootFolderId: root.id };
  });
}

export async function provisionOrganizationWorkspace(input: {
  organizationId: string;
  name: string;
  ownerId: string;
}): Promise<{ workspaceId: string; rootFolderId: string }> {
  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspace)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        type: "team",
        ownerId: input.ownerId,
      })
      .returning();
    if (!ws) throw new Error("workspace insert returned no row");

    await tx.insert(workspaceMember).values({
      workspaceId: ws.id,
      userId: input.ownerId,
      role: "owner",
    });

    const [root] = await tx
      .insert(folder)
      .values({
        workspaceId: ws.id,
        parentId: null,
        name: "root",
      })
      .returning();
    if (!root) throw new Error("folder insert returned no row");

    return { workspaceId: ws.id, rootFolderId: root.id };
  });
}
