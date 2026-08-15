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
