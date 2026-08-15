function splitSafeSegments(rawPath: string): string[] | null {
  const normalized = rawPath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return [];
  if (normalized.startsWith("/") || normalized.includes(":")) return null;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
    return null;
  }
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
