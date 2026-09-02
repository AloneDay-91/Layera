import { describe, expect, it } from "vitest";
import { getAppVersion } from "./app-version";
import {
  COMPOSE_UPDATE_COMMAND,
  fetchLatestRelease,
  isDevVersion,
  isUpdateAvailable,
  normalizeVersion,
  resetReleaseCache,
  toUpdatesResponse,
} from "./updates";

describe("normalizeVersion", () => {
  it("strips a leading v", () => {
    expect(normalizeVersion("v1.2.0")).toBe("1.2.0");
  });

  it("keeps a plain semver", () => {
    expect(normalizeVersion("1.2.0")).toBe("1.2.0");
  });

  it("returns null for prereleases", () => {
    expect(normalizeVersion("1.3.0-rc.1")).toBe(null);
    expect(normalizeVersion("v1.3.0-beta.1")).toBe(null);
  });

  it("returns null for junk", () => {
    expect(normalizeVersion("latest")).toBe(null);
    expect(normalizeVersion("")).toBe(null);
  });
});

describe("isDevVersion", () => {
  it("treats 0.0.0-dev as development", () => {
    expect(isDevVersion("0.0.0-dev")).toBe(true);
    expect(isDevVersion("1.0.0")).toBe(false);
  });
});

describe("isUpdateAvailable", () => {
  it("is true when latest is newer", () => {
    expect(isUpdateAvailable("1.2.0", "v1.3.0")).toBe(true);
  });

  it("is false when versions are equal", () => {
    expect(isUpdateAvailable("1.3.0", "v1.3.0")).toBe(false);
  });

  it("is false when current is newer", () => {
    expect(isUpdateAvailable("2.0.0", "v1.9.9")).toBe(false);
  });

  it("is false for a development build", () => {
    expect(isUpdateAvailable("0.0.0-dev", "v1.0.0")).toBe(false);
  });

  it("is false when latest is a prerelease", () => {
    expect(isUpdateAvailable("1.2.0", "v1.3.0-rc.1")).toBe(false);
  });
});

describe("toUpdatesResponse", () => {
  it("returns upToDate when there is no release", () => {
    expect(toUpdatesResponse("1.2.0", null)).toEqual({ upToDate: true, current: "1.2.0" });
  });

  it("returns the latest when GitHub is ahead", () => {
    expect(
      toUpdatesResponse("1.2.0", {
        tag_name: "v1.3.0",
        html_url: "https://github.com/AloneDay-91/filecloud-v2/releases/tag/v1.3.0",
      }),
    ).toEqual({
      upToDate: false,
      current: "1.2.0",
      latest: "1.3.0",
      tag: "v1.3.0",
      htmlUrl: "https://github.com/AloneDay-91/filecloud-v2/releases/tag/v1.3.0",
      composeCommand: COMPOSE_UPDATE_COMMAND,
    });
  });
});

describe("getAppVersion", () => {
  it("falls back to 0.0.0-dev", () => {
    expect(getAppVersion(undefined)).toBe("0.0.0-dev");
    expect(getAppVersion("")).toBe("0.0.0-dev");
  });

  it("returns a stamped version", () => {
    expect(getAppVersion("1.2.0")).toBe("1.2.0");
  });
});

describe("fetchLatestRelease", () => {
  it("returns null when GitHub errors", async () => {
    resetReleaseCache();
    const fetcher = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(fetchLatestRelease({ fetcher, now: 1, repo: "acme/app" })).resolves.toBe(null);
  });

  it("reuses the cache within one hour", async () => {
    resetReleaseCache();
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({ tag_name: "v1.4.0", html_url: "https://example.com/v1.4.0" }),
      };
    }) as unknown as typeof fetch;
    const first = await fetchLatestRelease({ fetcher, now: 0, repo: "acme/app" });
    const second = await fetchLatestRelease({ fetcher, now: 30 * 60 * 1000, repo: "acme/app" });
    expect(first?.tag_name).toBe("v1.4.0");
    expect(second?.tag_name).toBe("v1.4.0");
    expect(calls).toBe(1);
  });
});
