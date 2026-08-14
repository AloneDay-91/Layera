export const FOLDER_COLOR_OPTIONS = [
  { value: "default", label: "Défaut", textClass: "text-kumo-info" },
  { value: "red", label: "Rouge", textClass: "text-kumo-badge-red" },
  { value: "orange", label: "Orange", textClass: "text-kumo-badge-orange" },
  { value: "green", label: "Vert", textClass: "text-kumo-badge-green" },
  { value: "teal", label: "Sarcelle", textClass: "text-kumo-badge-teal" },
  { value: "blue", label: "Bleu", textClass: "text-kumo-badge-blue" },
  { value: "purple", label: "Violet", textClass: "text-kumo-badge-purple" },
  { value: "neutral", label: "Neutre", textClass: "text-kumo-badge-neutral" },
] as const;

export type FolderColorValue = (typeof FOLDER_COLOR_OPTIONS)[number]["value"];

export function getFolderColorClass(color: string | null | undefined): string {
  const match = FOLDER_COLOR_OPTIONS.find((opt) => opt.value === color);
  return match ? match.textClass : "text-kumo-info";
}
