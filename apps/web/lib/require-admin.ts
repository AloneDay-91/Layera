import { headers } from "next/headers";
import { auth } from "./auth";
import { canAccessAdmin, canDeleteWorkspaces, canManageInstanceSettings } from "./auth-permissions";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getAdminSession() {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.user.role)) {
    return null;
  }
  return session;
}

export async function getInstanceAdminSession() {
  const session = await getSession();
  if (!session || !canManageInstanceSettings(session.user.role)) {
    return null;
  }
  return session;
}

export async function getWorkspaceAdminSession() {
  const session = await getSession();
  if (!session || !canDeleteWorkspaces(session.user.role)) {
    return null;
  }
  return session;
}
