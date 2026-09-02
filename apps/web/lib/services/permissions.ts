import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess, requireWorkspaceMember, type AuthorizedWorkspace } from "@filecloud/db";
import { ServiceError } from "./errors";

export const WORKSPACE_COOKIE = "filecloud-workspace-id";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
};

export type AuthorizedContext = AuthorizedWorkspace & {
  actor: SessionUser;
};

export function assertOwner(ctx: AuthorizedContext) {
  if (ctx.role !== "owner") {
    throw new ServiceError(403, "Only the workspace owner can perform this action");
  }
}

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new ServiceError(401, "Unauthorized");
  }
  return session;
}

export async function getAuthorizedWorkspace(): Promise<AuthorizedContext> {
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  const session = await auth.api.getSession({ headers: headerList });
  if (!session) {
    throw new ServiceError(401, "Unauthorized");
  }
  const actor = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  const pinnedWorkspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (pinnedWorkspaceId) {
    try {
      const access = await requireWorkspaceMember(session.user.id, pinnedWorkspaceId);
      return { ...access, actor };
    } catch {
      // Cookie may point at a workspace the user left; fall back to the default.
    }
  }

  const access = await requireWorkspaceAccess({
    actorId: session.user.id,
    actorName: session.user.name,
    activeOrganizationId: session.session.activeOrganizationId,
  });
  return {
    ...access,
    actor,
  };
}
