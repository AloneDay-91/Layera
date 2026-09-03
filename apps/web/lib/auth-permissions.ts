import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const USER_ROLES = ["admin", "moderator", "support", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const admin = ac.newRole({
  ...adminAc.statements,
});

export const moderator = ac.newRole({
  user: ["list", "ban", "get"],
  session: ["list"],
});

export const support = ac.newRole({
  user: ["list", "get"],
  session: ["list"],
});

export const user = ac.newRole({
  user: [],
  session: [],
});

export const authRoles = {
  admin,
  moderator,
  support,
  user,
};

/** Roles that can call Better Auth admin APIs (ban, set-role, …). */
export const ADMIN_PLUGIN_ROLES = ["admin", "moderator"] as const;

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "admin" || value === "moderator" || value === "support" || value === "user";
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  return isUserRole(role) ? role : "user";
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "admin" || normalized === "moderator" || normalized === "support";
}

export function canManageInstanceSettings(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "admin";
}

export function canSetUserRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "admin";
}

export function canBanUsers(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "admin" || normalized === "moderator";
}

export function canDeleteWorkspaces(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "admin" || normalized === "moderator";
}

export function roleMessageKey(role: UserRole): "roleAdmin" | "roleModerator" | "roleSupport" | "roleUser" {
  switch (role) {
    case "admin":
      return "roleAdmin";
    case "moderator":
      return "roleModerator";
    case "support":
      return "roleSupport";
    case "user":
      return "roleUser";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
