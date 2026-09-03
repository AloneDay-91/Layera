import { describe, expect, it } from "vitest";
import { resolveSocialProvider } from "./social-providers";

const emptyEnv = { clientId: "", clientSecret: "" };
const envCreds = { clientId: "env-id", clientSecret: "env-secret" };

describe("resolveSocialProvider", () => {
  it("uses environment credentials when the database is empty", () => {
    const resolved = resolveSocialProvider({ enabled: true, clientId: "", clientSecret: "" }, envCreds);
    expect(resolved.enabled).toBe(true);
    expect(resolved.configured).toBe(true);
    expect(resolved.clientId).toBe("env-id");
    expect(resolved.secretSet).toBe(true);
  });

  it("prefers database credentials over the environment", () => {
    const resolved = resolveSocialProvider(
      { enabled: true, clientId: "db-id", clientSecret: "db-secret" },
      envCreds,
    );
    expect(resolved.clientId).toBe("db-id");
    expect(resolved.clientSecret).toBe("db-secret");
  });

  it("can disable a configured provider", () => {
    const resolved = resolveSocialProvider({ enabled: false, clientId: "id", clientSecret: "secret" }, emptyEnv);
    expect(resolved.configured).toBe(true);
    expect(resolved.enabled).toBe(false);
  });

  it("is not enabled when credentials are missing", () => {
    const resolved = resolveSocialProvider({ enabled: true, clientId: "", clientSecret: "" }, emptyEnv);
    expect(resolved.configured).toBe(false);
    expect(resolved.enabled).toBe(false);
  });
});
