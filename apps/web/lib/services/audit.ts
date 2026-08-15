import { db, auditLog, user, eq, desc } from "@filecloud/db";
import type { AuthorizedContext } from "./permissions";

export type AuditAction =
  | "file.upload"
  | "file.rename"
  | "file.move"
  | "file.trash"
  | "file.delete"
  | "file.download"
  | "file.restore"
  | "folder.create"
  | "folder.rename"
  | "folder.move"
  | "folder.trash"
  | "folder.delete"
  | "folder.restore"
  | "share.create"
  | "share.revoke"
  | "share.download";

export async function recordAudit(input: {
  workspaceId: string;
  actorId: string;
  action: AuditAction;
  targetType?: "file" | "folder" | "share";
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLog).values({
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error);
  }
}

export async function listAuditEvents(ctx: AuthorizedContext, limit = 100) {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorId: auditLog.actorId,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLog)
    .innerJoin(user, eq(user.id, auditLog.actorId))
    .where(eq(auditLog.workspaceId, ctx.workspace.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    actor: { id: row.actorId, name: row.actorName, email: row.actorEmail },
  }));
}
