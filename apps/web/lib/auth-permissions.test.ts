import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canBanUsers,
  canDeleteWorkspaces,
  canManageInstanceSettings,
  canSetUserRole,
  normalizeUserRole,
  roleMessageKey,
} from "./auth-permissions";

describe("auth-permissions", () => {
  it("treats unknown roles as user", () => {
    expect(normalizeUserRole(null)).toBe("user");
    expect(normalizeUserRole("owner")).toBe("user");
    expect(normalizeUserRole("admin")).toBe("admin");
  });

  it("grants staff access to the admin area", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("moderator")).toBe(true);
    expect(canAccessAdmin("support")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
  });

  it("reserves settings and role changes for administrators", () => {
    expect(canManageInstanceSettings("admin")).toBe(true);
    expect(canManageInstanceSettings("moderator")).toBe(false);
    expect(canSetUserRole("admin")).toBe(true);
    expect(canSetUserRole("moderator")).toBe(false);
  });

  it("lets moderators ban and delete workspaces, but not support", () => {
    expect(canBanUsers("moderator")).toBe(true);
    expect(canDeleteWorkspaces("moderator")).toBe(true);
    expect(canBanUsers("support")).toBe(false);
    expect(canDeleteWorkspaces("support")).toBe(false);
  });

  it("maps roles to message keys", () => {
    expect(roleMessageKey("admin")).toBe("roleAdmin");
    expect(roleMessageKey("moderator")).toBe("roleModerator");
    expect(roleMessageKey("support")).toBe("roleSupport");
    expect(roleMessageKey("user")).toBe("roleUser");
  });
});
