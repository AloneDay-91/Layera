import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DEV_VERSION = "0.0.0-dev";

function envVersion(): string | undefined {
  // Dynamic key so Next.js does not inline an empty APP_VERSION at build time.
  const value = process.env["APP_VERSION"]?.trim();
  if (!value || value === DEV_VERSION) return undefined;
  return value;
}

function fileVersion(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  const candidates = [join(process.cwd(), "VERSION"), join(process.cwd(), "../../VERSION")];
  for (const file of candidates) {
    try {
      const value = readFileSync(file, "utf8").trim();
      if (value) return value;
    } catch {
      // Missing file is expected in some layouts.
    }
  }
  return undefined;
}

export function getAppVersion(raw?: string): string {
  if (raw !== undefined) {
    const value = raw.trim();
    return value ? value : DEV_VERSION;
  }
  return envVersion() ?? fileVersion() ?? DEV_VERSION;
}
