import {
  db,
  user,
  account,
  session,
  workspace,
  workspaceMember,
  organization,
  file,
  folder,
  shareLink,
  eq,
  and,
  ilike,
  inArray,
  isNull,
  ne,
  desc,
  or,
  sql,
} from "@filecloud/db";
import { getQuotaLimits } from "./instance-settings";
import { normalizeUserRole } from "../auth-permissions";

const USER_LIMIT = 100;

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  providers: string[];
  workspaceCount: number;
  activeSessionCount: number;
  lastSeenAt: string | null;
  createdAt: string;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  type: string;
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string;
  organizationName: string | null;
  memberCount: number;
  fileCount: number;
  folderCount: number;
  shareCount: number;
  storageBytes: number;
  quotaBytes: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

function likePattern(query: string): string {
  return `%${query.replace(/[%_]/g, "")}%`;
}

export async function listAdminUsers(search?: string): Promise<AdminUserRow[]> {
  const trimmed = search?.trim();
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(
      trimmed
        ? or(ilike(user.name, likePattern(trimmed)), ilike(user.email, likePattern(trimmed)))
        : undefined,
    )
    .orderBy(desc(user.createdAt))
    .limit(USER_LIMIT);

  const userIds = users.map((row) => row.id);
  if (userIds.length === 0) return [];

  const [accounts, sessionRows, memberships] = await Promise.all([
    db
      .select({ userId: account.userId, providerId: account.providerId })
      .from(account)
      .where(inArray(account.userId, userIds)),
    db
      .select({
        userId: session.userId,
        lastSeenAt: sql<Date>`max(${session.updatedAt})`,
        activeCount: sql<number>`count(*) filter (where ${session.expiresAt} > now())::int`,
      })
      .from(session)
      .where(inArray(session.userId, userIds))
      .groupBy(session.userId),
    db
      .select({
        userId: workspaceMember.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(workspaceMember)
      .where(inArray(workspaceMember.userId, userIds))
      .groupBy(workspaceMember.userId),
  ]);

  const providersByUser = new Map<string, string[]>();
  for (const row of accounts) {
    const list = providersByUser.get(row.userId) ?? [];
    if (!list.includes(row.providerId)) list.push(row.providerId);
    providersByUser.set(row.userId, list);
  }

  const sessionsByUser = new Map(
    sessionRows.map((row) => [
      row.userId,
      {
        lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
        activeCount: asNumber(row.activeCount),
      },
    ]),
  );
  const workspacesByUser = new Map(memberships.map((row) => [row.userId, asNumber(row.count)]));

  return users.map((row) => {
    const sessionInfo = sessionsByUser.get(row.id);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: normalizeUserRole(row.role),
      banned: Boolean(row.banned),
      banReason: row.banReason,
      emailVerified: row.emailVerified,
      twoFactorEnabled: Boolean(row.twoFactorEnabled),
      providers: providersByUser.get(row.id) ?? [],
      workspaceCount: workspacesByUser.get(row.id) ?? 0,
      activeSessionCount: sessionInfo?.activeCount ?? 0,
      lastSeenAt: sessionInfo?.lastSeenAt ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function listAdminWorkspaces(): Promise<AdminWorkspaceRow[]> {
  const [{ quotaBytes }, workspaces] = await Promise.all([
    getQuotaLimits(),
    db.select().from(workspace),
  ]);

  const ownerIds = [...new Set(workspaces.map((row) => row.ownerId))];
  const orgIds = [...new Set(workspaces.map((row) => row.organizationId).filter((id): id is string => id !== null))];
  const workspaceIds = workspaces.map((row) => row.id);

  const [owners, orgs, memberRows, fileRows, folderRows, shareRows] = await Promise.all([
    ownerIds.length > 0 ? db.select().from(user).where(inArray(user.id, ownerIds)) : Promise.resolve([]),
    orgIds.length > 0 ? db.select().from(organization).where(inArray(organization.id, orgIds)) : Promise.resolve([]),
    workspaceIds.length > 0
      ? db
          .select({
            workspaceId: workspaceMember.workspaceId,
            count: sql<number>`count(*)::int`,
          })
          .from(workspaceMember)
          .where(inArray(workspaceMember.workspaceId, workspaceIds))
          .groupBy(workspaceMember.workspaceId)
      : Promise.resolve([]),
    workspaceIds.length > 0
      ? db
          .select({
            workspaceId: file.workspaceId,
            count: sql<number>`count(*)::int`,
            used: sql<number>`coalesce(sum(${file.size}), 0)`,
            lastActivity: sql<Date>`max(${file.updatedAt})`,
          })
          .from(file)
          .where(inArray(file.workspaceId, workspaceIds))
          .groupBy(file.workspaceId)
      : Promise.resolve([]),
    workspaceIds.length > 0
      ? db
          .select({
            workspaceId: folder.workspaceId,
            count: sql<number>`count(*)::int`,
            lastActivity: sql<Date>`max(${folder.updatedAt})`,
          })
          .from(folder)
          .where(and(inArray(folder.workspaceId, workspaceIds), ne(folder.name, "root")))
          .groupBy(folder.workspaceId)
      : Promise.resolve([]),
    workspaceIds.length > 0
      ? db
          .select({
            workspaceId: shareLink.workspaceId,
            count: sql<number>`count(*)::int`,
          })
          .from(shareLink)
          .where(and(inArray(shareLink.workspaceId, workspaceIds), isNull(shareLink.revokedAt)))
          .groupBy(shareLink.workspaceId)
      : Promise.resolve([]),
  ]);

  const ownerById = new Map(owners.map((row) => [row.id, row]));
  const orgById = new Map(orgs.map((row) => [row.id, row]));
  const membersByWorkspace = new Map(memberRows.map((row) => [row.workspaceId, asNumber(row.count)]));
  const filesByWorkspace = new Map(
    fileRows.map((row) => [
      row.workspaceId,
      {
        count: asNumber(row.count),
        used: asNumber(row.used),
        lastActivity: row.lastActivity ? new Date(row.lastActivity) : null,
      },
    ]),
  );
  const foldersByWorkspace = new Map(
    folderRows.map((row) => [
      row.workspaceId,
      {
        count: asNumber(row.count),
        lastActivity: row.lastActivity ? new Date(row.lastActivity) : null,
      },
    ]),
  );
  const sharesByWorkspace = new Map(shareRows.map((row) => [row.workspaceId, asNumber(row.count)]));

  return workspaces
    .map((row) => {
      const owner = ownerById.get(row.ownerId);
      const org = row.organizationId ? orgById.get(row.organizationId) : undefined;
      const files = filesByWorkspace.get(row.id);
      const folders = foldersByWorkspace.get(row.id);
      const activityDates = [row.updatedAt, files?.lastActivity ?? null, folders?.lastActivity ?? null].filter(
        (value): value is Date => value instanceof Date,
      );
      const lastActivity = activityDates.reduce<Date | null>((latest, date) => {
        if (!latest || date > latest) return date;
        return latest;
      }, null);

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? "",
        ownerEmail: owner?.email ?? "",
        organizationName: org?.name ?? null,
        memberCount: membersByWorkspace.get(row.id) ?? (row.type === "personal" ? 1 : 0),
        fileCount: files?.count ?? 0,
        folderCount: folders?.count ?? 0,
        shareCount: sharesByWorkspace.get(row.id) ?? 0,
        storageBytes: files?.used ?? 0,
        quotaBytes,
        lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
