import { describe, expect, it } from "vitest";
import { DEV_VERSION, getAppVersion } from "./app-version";

describe("getAppVersion", () => {
  it("falls back to 0.0.0-dev for empty input", () => {
    expect(getAppVersion("")).toBe(DEV_VERSION);
    expect(getAppVersion("   ")).toBe(DEV_VERSION);
  });

  it("returns a stamped version", () => {
    expect(getAppVersion("1.2.0")).toBe("1.2.0");
  });

  it("does not read the VERSION file outside production", () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(getAppVersion(DEV_VERSION)).toBe(DEV_VERSION);
  });
});
