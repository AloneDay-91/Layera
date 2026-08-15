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

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new ServiceError(401, "Unauthorized");
  }
  return session;
}

export async function getAuthorizedWorkspace(): Promise<AuthorizedContext> {
  const session = await requireSession();
  const actor = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };

  const cookieStore = await cookies();
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
