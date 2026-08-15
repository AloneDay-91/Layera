import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, user, organization, workspaceMember, file } from "./client";
import { provisionOrganizationWorkspace, provisionPersonalWorkspace } from "./provisioning";
import { requireWorkspaceAccess, requireWorkspaceMember, WorkspaceAccessError } from "./access";

async function insertUser(name: string) {
  const id = `test-user-${randomUUID()}`;
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.com`,
  });
  return id;
}

describe("workspace access", () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  afterEach(async () => {
    for (const orgId of createdOrgIds.splice(0)) {
      await db.delete(organization).where(eq(organization.id, orgId));
    }
    for (const userId of createdUserIds.splice(0)) {
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  it("allows the personal workspace owner and denies a stranger", async () => {
    const ownerId = await insertUser("Owner");
    const strangerId = await insertUser("Stranger");
    createdUserIds.push(ownerId, strangerId);

    const provisioned = await provisionPersonalWorkspace({ userId: ownerId, userName: "Owner" });

    const allowed = await requireWorkspaceMember(ownerId, provisioned.workspaceId);
    expect(allowed.role).toBe("owner");
    expect(allowed.workspace.id).toBe(provisioned.workspaceId);

    await expect(requireWorkspaceMember(strangerId, provisioned.workspaceId)).rejects.toSatisfy(
      (error: unknown) => error instanceof WorkspaceAccessError && error.status === 403,
    );
  });

  it("does not resolve another user's personal workspace from the stranger's session", async () => {
    const ownerId = await insertUser("Owner");
    const strangerId = await insertUser("Stranger");
    createdUserIds.push(ownerId, strangerId);

    const ownerWs = await provisionPersonalWorkspace({ userId: ownerId, userName: "Owner" });
    const strangerAccess = await requireWorkspaceAccess({
      actorId: strangerId,
      actorName: "Stranger",
    });

    expect(strangerAccess.workspace.id).not.toBe(ownerWs.workspaceId);
    expect(strangerAccess.workspace.ownerId).toBe(strangerId);
  });

  it("enrolls an organization member who is missing from workspace_member", async () => {
    const ownerId = await insertUser("Org Owner");
    const memberId = await insertUser("Org Member");
    createdUserIds.push(ownerId, memberId);

    const orgId = `test-org-${randomUUID()}`;
    createdOrgIds.push(orgId);
    await db.insert(organization).values({ id: orgId, name: "Team", slug: orgId });

    const provisioned = await provisionOrganizationWorkspace({
      organizationId: orgId,
      name: "Team",
      ownerId,
    });

    const access = await requireWorkspaceAccess({
      actorId: memberId,
      actorName: "Org Member",
      activeOrganizationId: orgId,
    });

    expect(access.workspace.id).toBe(provisioned.workspaceId);
    expect(access.role).toBe("member");

    const [row] = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.userId, memberId));
    expect(row?.workspaceId).toBe(provisioned.workspaceId);
    expect(row?.role).toBe("member");
  });

  it("does not leak files from one personal workspace into another", async () => {
    const ownerA = await insertUser("Owner A");
    const ownerB = await insertUser("Owner B");
    createdUserIds.push(ownerA, ownerB);

    const wsA = await provisionPersonalWorkspace({ userId: ownerA, userName: "Owner A" });
    const wsB = await provisionPersonalWorkspace({ userId: ownerB, userName: "Owner B" });

    await db.insert(file).values({
      workspaceId: wsA.workspaceId,
      folderId: wsA.rootFolderId,
      name: "secret.txt",
      mimeType: "text/plain",
      size: 12,
      storageKey: `workspaces/${wsA.workspaceId}/${randomUUID()}`,
    });

    const filesInB = await db.select().from(file).where(eq(file.workspaceId, wsB.workspaceId));
    expect(filesInB).toHaveLength(0);

    const [secret] = await db.select().from(file).where(eq(file.workspaceId, wsA.workspaceId));
    expect(secret?.name).toBe("secret.txt");

    await expect(requireWorkspaceMember(ownerB, wsA.workspaceId)).rejects.toSatisfy(
      (error: unknown) => error instanceof WorkspaceAccessError && error.status === 403,
    );
  });
});
