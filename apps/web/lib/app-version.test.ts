import { describe, expect, it } from "vitest";
import { DEV_VERSION, RELEASED_VERSION, getAppVersion } from "./app-version";

describe("getAppVersion", () => {
  it("falls back to 0.0.0-dev for empty input", () => {
    expect(getAppVersion("")).toBe(DEV_VERSION);
    expect(getAppVersion("   ")).toBe(DEV_VERSION);
  });

  it("returns a stamped version", () => {
    expect(getAppVersion("1.2.0")).toBe("1.2.0");
  });

  it("keeps an explicit development version", () => {
    expect(getAppVersion(DEV_VERSION)).toBe(DEV_VERSION);
  });

  it("ships a released fallback for production images", () => {
    expect(RELEASED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
