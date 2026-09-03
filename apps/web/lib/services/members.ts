import { db, workspace, workspaceMember, itemShare, user, eq, and } from "@filecloud/db";
import type { WorkspaceRole } from "@filecloud/types";
import { ServiceError } from "./errors";
import { assertOwner, type AuthorizedContext } from "./permissions";
import { findUserByEmail } from "./users";
import { recordAudit } from "./audit";

export async function listAccessibleWorkspaces(actorId: string) {
  const rows = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      organizationId: workspace.organizationId,
      role: workspaceMember.role,
    })
    .from(workspaceMember)
    .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
    .where(eq(workspaceMember.userId, actorId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    organizationId: row.organizationId,
    role: row.role,
  }));
}

export async function listWorkspaceMembers(ctx: AuthorizedContext) {
  const rows = await db
    .select({
      membershipId: workspaceMember.id,
      userId: workspaceMember.userId,
      role: workspaceMember.role,
      createdAt: workspaceMember.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(workspaceMember)
    .innerJoin(user, eq(user.id, workspaceMember.userId))
    .where(eq(workspaceMember.workspaceId, ctx.workspace.id));

  return rows.map((row) => ({
    id: row.userId,
    membershipId: row.membershipId,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function inviteWorkspaceMember(ctx: AuthorizedContext, email: string) {
  assertOwner(ctx);
  const target = await findUserByEmail(email);
  if (!target) throw new ServiceError(400, "Unable to add this user");
  if (target.id === ctx.actor.id) throw new ServiceError(400, "You are already a member");

  const [existing] = await db
    .select({ id: workspaceMember.id })
    .from(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, ctx.workspace.id), eq(workspaceMember.userId, target.id)))
    .limit(1);
  if (existing) throw new ServiceError(409, "User is already a member");

  await db.insert(workspaceMember).values({
    workspaceId: ctx.workspace.id,
    userId: target.id,
    role: "member" satisfies WorkspaceRole,
  });

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "member.invite",
    targetType: "share",
    targetId: undefined,
    metadata: { userId: target.id, email: target.email },
  });

  return { id: target.id, name: target.name, email: target.email, role: "member" as const };
}

export async function removeWorkspaceMember(ctx: AuthorizedContext, userId: string) {
  assertOwner(ctx);
  if (userId === ctx.workspace.ownerId) {
    throw new ServiceError(400, "Cannot remove the workspace owner");
  }

  const deleted = await db
    .delete(workspaceMember)
    .where(and(eq(workspaceMember.workspaceId, ctx.workspace.id), eq(workspaceMember.userId, userId)))
    .returning({ id: workspaceMember.id });
  if (!deleted[0]) throw new ServiceError(404, "Member not found");

  // Leaves no dangling grant behind in "shared with me" for someone who can
  // no longer reach the workspace.
  await db
    .delete(itemShare)
    .where(and(eq(itemShare.workspaceId, ctx.workspace.id), eq(itemShare.sharedWithUserId, userId)));

  await recordAudit({
    workspaceId: ctx.workspace.id,
    actorId: ctx.actor.id,
    action: "member.remove",
    metadata: { userId },
  });
}
