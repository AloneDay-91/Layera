export const DEV_VERSION = "0.0.0-dev";

// Fallback when APP_VERSION was not stamped into the image (Dokploy source
// builds). Keep in sync with the repo-root VERSION file.
export const RELEASED_VERSION = "1.2.0";

function envVersion(): string | undefined {
  // Dynamic key so Next.js does not inline an empty APP_VERSION at build time.
  const value = process.env["APP_VERSION"]?.trim();
  if (!value || value === DEV_VERSION) return undefined;
  return value;
}

export function getAppVersion(raw?: string): string {
  if (raw !== undefined) {
    const value = raw.trim();
    return value ? value : DEV_VERSION;
  }
  return envVersion() ?? (process.env.NODE_ENV === "production" ? RELEASED_VERSION : DEV_VERSION);
}
