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

    return { workspaceId: ws.id, rootFolderId: root.id };
  });
}
