export const FOLDER_COLOR_OPTIONS = [
  { value: "default", textClass: "text-kumo-info" },
  { value: "red", textClass: "text-kumo-badge-red" },
  { value: "orange", textClass: "text-kumo-badge-orange" },
  { value: "green", textClass: "text-kumo-badge-green" },
  { value: "teal", textClass: "text-kumo-badge-teal" },
  { value: "blue", textClass: "text-kumo-badge-blue" },
  { value: "purple", textClass: "text-kumo-badge-purple" },
  { value: "neutral", textClass: "text-kumo-badge-neutral" },
] as const;

export type FolderColorValue = (typeof FOLDER_COLOR_OPTIONS)[number]["value"];

export function getFolderColorClass(color: string | null | undefined): string {
  const match = FOLDER_COLOR_OPTIONS.find((opt) => opt.value === color);
  return match ? match.textClass : "text-kumo-info";
}
