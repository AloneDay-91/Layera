import type { WorkspaceRole } from "@filecloud/types";
import { db, workspace, workspaceMember, eq, and, isNull } from "./client";
import { provisionOrganizationWorkspace, provisionPersonalWorkspace } from "./provisioning";

export class WorkspaceAccessError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
    this.status = status;
  }
}

export type WorkspaceRow = typeof workspace.$inferSelect;

export type AuthorizedWorkspace = {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
};

async function findMembership(workspaceId: string, actorId: string) {
  const [row] = await db
    .select()
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, actorId)))
    .limit(1);
  return row ?? null;
}

async function enrollMember(workspaceId: string, actorId: string, role: WorkspaceRole) {
  const [row] = await db
    .insert(workspaceMember)
    .values({ workspaceId, userId: actorId, role })
    .onConflictDoNothing({
      target: [workspaceMember.workspaceId, workspaceMember.userId],
    })
    .returning();
  if (row) return row;
  const existing = await findMembership(workspaceId, actorId);
  if (!existing) {
    throw new WorkspaceAccessError(403, "Forbidden");
  }
  return existing;
}

/**
 * Resolves the caller's active workspace (personal, or the Better Auth org
 * currently selected) and requires a `workspace_member` row. Org members who
 * are not yet in `workspace_member` are enrolled as `member` — Better Auth
 * already gated `activeOrganizationId`.
 */
export async function requireWorkspaceAccess(input: {
  actorId: string;
  actorName: string;
  activeOrganizationId?: string | null;
}): Promise<AuthorizedWorkspace> {
  let ws: WorkspaceRow | undefined;

  if (input.activeOrganizationId) {
    const found = await db
      .select()
      .from(workspace)
      .where(eq(workspace.organizationId, input.activeOrganizationId))
      .limit(1);
    ws = found[0];

    if (!ws) {
      const provisioned = await provisionOrganizationWorkspace({
        organizationId: input.activeOrganizationId,
        name: "Workspace Équipe",
        ownerId: input.actorId,
      });
      const created = await db.select().from(workspace).where(eq(workspace.id, provisioned.workspaceId)).limit(1);
      ws = created[0];
    }
  } else {
    const found = await db
      .select()
      .from(workspace)
      .where(and(eq(workspace.ownerId, input.actorId), isNull(workspace.organizationId)))
      .limit(1);
    ws = found[0];

    if (!ws) {
      const provisioned = await provisionPersonalWorkspace({
        userId: input.actorId,
        userName: input.actorName,
      });
      const created = await db.select().from(workspace).where(eq(workspace.id, provisioned.workspaceId)).limit(1);
      ws = created[0];
    }
  }

  if (!ws) {
    throw new WorkspaceAccessError(404, "Workspace not found");
  }

  let membership = await findMembership(ws.id, input.actorId);

  if (!membership && ws.organizationId && ws.organizationId === input.activeOrganizationId) {
    membership = await enrollMember(ws.id, input.actorId, "member");
  }

  if (!membership && ws.ownerId === input.actorId) {
    membership = await enrollMember(ws.id, input.actorId, "owner");
  }

  if (!membership) {
    throw new WorkspaceAccessError(403, "Forbidden");
  }

  return { workspace: ws, role: membership.role };
}

/** Checks membership of an already-known workspace (no provisioning). */
export async function requireWorkspaceMember(
  actorId: string,
  workspaceId: string,
): Promise<AuthorizedWorkspace> {
  const [ws] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);
  if (!ws) {
    throw new WorkspaceAccessError(404, "Workspace not found");
  }

  const membership = await findMembership(workspaceId, actorId);
  if (!membership) {
    throw new WorkspaceAccessError(403, "Forbidden");
  }

  return { workspace: ws, role: membership.role };
}
