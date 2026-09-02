export const DEV_VERSION = "0.0.0-dev";

export function getAppVersion(raw = process.env.APP_VERSION): string {
  const value = raw?.trim();
  return value ? value : DEV_VERSION;
}
