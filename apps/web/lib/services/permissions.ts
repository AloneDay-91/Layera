import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireWorkspaceAccess, type AuthorizedWorkspace } from "@filecloud/db";
import { ServiceError } from "./errors";

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
  const access = await requireWorkspaceAccess({
    actorId: session.user.id,
    actorName: session.user.name,
    activeOrganizationId: session.session.activeOrganizationId,
  });
  return {
    ...access,
    actor: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
  };
}
