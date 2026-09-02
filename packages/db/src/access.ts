import type { WorkspaceRole } from "@filecloud/types";
import { db, workspace, workspaceMember, eq, and, isNull, type SQL } from "./client";
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

async function loadWorkspaceWithMembership(actorId: string, workspaceWhere: SQL | undefined) {
  const [row] = await db
    .select({
      workspace,
      role: workspaceMember.role,
    })
    .from(workspace)
    .leftJoin(
      workspaceMember,
      and(eq(workspaceMember.workspaceId, workspace.id), eq(workspaceMember.userId, actorId)),
    )
    .where(workspaceWhere)
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
  const found = input.activeOrganizationId
    ? await loadWorkspaceWithMembership(input.actorId, eq(workspace.organizationId, input.activeOrganizationId))
    : await loadWorkspaceWithMembership(
        input.actorId,
        and(eq(workspace.ownerId, input.actorId), isNull(workspace.organizationId)),
      );

  let ws = found?.workspace;
  let role = found?.role ?? null;

  if (!ws && input.activeOrganizationId) {
    const provisioned = await provisionOrganizationWorkspace({
      organizationId: input.activeOrganizationId,
      name: "Workspace Équipe",
      ownerId: input.actorId,
    });
    const created = await db.select().from(workspace).where(eq(workspace.id, provisioned.workspaceId)).limit(1);
    ws = created[0];
  } else if (!ws) {
    const provisioned = await provisionPersonalWorkspace({
      userId: input.actorId,
      userName: input.actorName,
    });
    const created = await db.select().from(workspace).where(eq(workspace.id, provisioned.workspaceId)).limit(1);
    ws = created[0];
  }

  if (!ws) {
    throw new WorkspaceAccessError(404, "Workspace not found");
  }

  if (!role && ws.organizationId && ws.organizationId === input.activeOrganizationId) {
    const membership = await enrollMember(ws.id, input.actorId, "member");
    role = membership.role;
  }

  if (!role && ws.ownerId === input.actorId) {
    const membership = await enrollMember(ws.id, input.actorId, "owner");
    role = membership.role;
  }

  if (!role) {
    throw new WorkspaceAccessError(403, "Forbidden");
  }

  return { workspace: ws, role };
}

/** Checks membership of an already-known workspace (no provisioning). */
export async function requireWorkspaceMember(
  actorId: string,
  workspaceId: string,
): Promise<AuthorizedWorkspace> {
  const row = await loadWorkspaceWithMembership(actorId, eq(workspace.id, workspaceId));
  if (!row) {
    throw new WorkspaceAccessError(404, "Workspace not found");
  }
  if (!row.role) {
    throw new WorkspaceAccessError(403, "Forbidden");
  }
  return { workspace: row.workspace, role: row.role };
}
