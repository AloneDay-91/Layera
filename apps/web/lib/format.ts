export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "Kb", "Mb", "Gb"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelativeTime(iso: string | null, locale: string, neverLabel: string): string {
  if (!iso) return neverLabel;
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 14 * day) return rtf.format(Math.round(diffMs / day), "day");
  return date.toLocaleDateString(locale, { dateStyle: "medium" });
}
