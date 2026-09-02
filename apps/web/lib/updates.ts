import { DEV_VERSION, getAppVersion } from "./app-version";

export { getAppVersion };

export const DEFAULT_GITHUB_REPO = "AloneDay-91/filecloud-v2";
export const COMPOSE_UPDATE_COMMAND =
  "docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d";
export const DISMISSED_UPDATE_KEY = "filecloud-dismissed-update";
const CACHE_MS = 60 * 60 * 1000;

export type GitHubRelease = {
  tag_name: string;
  html_url: string;
};

export type UpdatesResponse =
  | { upToDate: true; current: string }
  | {
      upToDate: false;
      current: string;
      latest: string;
      tag: string;
      htmlUrl: string;
      composeCommand: string;
    };

type CacheEntry = { at: number; release: GitHubRelease | null };

let releaseCache: CacheEntry | null = null;

export function isDevVersion(version: string): boolean {
  return version === DEV_VERSION;
}

export function normalizeVersion(raw: string): string | null {
  const value = raw.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+$/.test(value)) return null;
  return value;
}

function parseStable(version: string): [number, number, number] | null {
  const normalized = normalizeVersion(version);
  if (!normalized) return null;
  const [major = 0, minor = 0, patch = 0] = normalized.split(".").map(Number);
  return [major, minor, patch];
}

export function isUpdateAvailable(current: string, latest: string): boolean {
  if (isDevVersion(current)) return false;
  const a = parseStable(current);
  const b = parseStable(latest);
  if (!a || !b) return false;
  if (b[0] !== a[0]) return b[0] > a[0];
  if (b[1] !== a[1]) return b[1] > a[1];
  return b[2] > a[2];
}

export function toUpdatesResponse(current: string, release: GitHubRelease | null): UpdatesResponse {
  if (!release || !isUpdateAvailable(current, release.tag_name)) {
    return { upToDate: true, current };
  }
  const latest = normalizeVersion(release.tag_name);
  if (!latest) {
    return { upToDate: true, current };
  }
  return {
    upToDate: false,
    current,
    latest,
    tag: release.tag_name.startsWith("v") ? release.tag_name : `v${latest}`,
    htmlUrl: release.html_url,
    composeCommand: COMPOSE_UPDATE_COMMAND,
  };
}

export function githubRepo(env = process.env.GITHUB_REPO): string {
  const value = env?.trim();
  return value ? value : DEFAULT_GITHUB_REPO;
}

export async function fetchLatestRelease(options?: {
  now?: number;
  fetcher?: typeof fetch;
  token?: string;
  repo?: string;
}): Promise<GitHubRelease | null> {
  const now = options?.now ?? Date.now();
  if (releaseCache && now - releaseCache.at < CACHE_MS) {
    return releaseCache.release;
  }

  const repo = options?.repo ?? githubRepo();
  const fetcher = options?.fetcher ?? fetch;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "layera",
  };
  const token = options?.token ?? process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetcher(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (!res.ok) {
      releaseCache = { at: now, release: null };
      return null;
    }
    const body = (await res.json()) as Partial<GitHubRelease>;
    if (typeof body.tag_name !== "string" || typeof body.html_url !== "string") {
      releaseCache = { at: now, release: null };
      return null;
    }
    const release = { tag_name: body.tag_name, html_url: body.html_url };
    releaseCache = { at: now, release };
    return release;
  } catch (error) {
    console.error("[updates] failed to fetch GitHub release", error);
    releaseCache = { at: now, release: null };
    return null;
  }
}

export function resetReleaseCache() {
  releaseCache = null;
}
