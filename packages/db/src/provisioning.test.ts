import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, user, workspace, workspaceMember, folder } from "./client";
import { provisionPersonalWorkspace } from "./provisioning";

describe("provisionPersonalWorkspace", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const userId of createdUserIds.splice(0)) {
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  it("creates a personal workspace, root folder, and owner membership", async () => {
    const userId = `test-user-${randomUUID()}`;
    createdUserIds.push(userId);
    await db.insert(user).values({
      id: userId,
      name: "Test User",
      email: `${userId}@example.com`,
    });

    const result = await provisionPersonalWorkspace({ userId, userName: "Test User" });

    const [ws] = await db.select().from(workspace).where(eq(workspace.id, result.workspaceId));
    expect(ws.name).toBe("Test User's Workspace");
    expect(ws.type).toBe("personal");
    expect(ws.ownerId).toBe(userId);

    const [member] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, result.workspaceId));
    expect(member.userId).toBe(userId);
    expect(member.role).toBe("owner");

    const [root] = await db.select().from(folder).where(eq(folder.id, result.rootFolderId));
    expect(root.workspaceId).toBe(result.workspaceId);
    expect(root.parentId).toBeNull();
    expect(root.name).toBe("root");
  });
});
