import { isSafeItemName } from "./item-name";

// Each level becomes a folder row, so an archive nesting thousands of
// directories would otherwise turn one request into thousands of inserts.
export const MAX_ZIP_DEPTH = 32;

function splitSafeSegments(rawPath: string): string[] | null {
  const normalized = rawPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return [];
  if (normalized.startsWith("/") || normalized.includes(":")) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length > MAX_ZIP_DEPTH) return null;
  if (segments.some((segment) => !isSafeItemName(segment))) return null;
  return segments;
}

export function sanitizeZipEntryPath(rawPath: string): { dirPath: string; fileName: string } | null {
  const segments = splitSafeSegments(rawPath);
  if (!segments || segments.length === 0) return null;
  const fileName = segments[segments.length - 1]!;
  const dirPath = segments.slice(0, -1).join("/");
  return { dirPath, fileName };
}

export function sanitizeZipDirPath(rawPath: string): string | null {
  const segments = splitSafeSegments(rawPath);
  if (!segments) return null;
  return segments.join("/");
}
