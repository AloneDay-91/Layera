import { describe, expect, it } from "vitest";
import { AUTH_TIMEOUT_CODE, isAuthTimeout, withAuthTimeout } from "./auth-action";

describe("withAuthTimeout", () => {
  it("returns the resolved value when it finishes in time", async () => {
    await expect(withAuthTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejects when the action takes too long", async () => {
    await expect(
      withAuthTimeout(new Promise(() => undefined), 10),
    ).rejects.toMatchObject({ name: AUTH_TIMEOUT_CODE });
  });
});

describe("isAuthTimeout", () => {
  it("detects timeout errors", () => {
    const error = new Error(AUTH_TIMEOUT_CODE);
    error.name = AUTH_TIMEOUT_CODE;
    expect(isAuthTimeout(error)).toBe(true);
    expect(isAuthTimeout(new Error("nope"))).toBe(false);
  });
});
