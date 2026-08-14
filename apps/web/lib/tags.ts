export const TAG_COLOR_OPTIONS = [
  { value: "neutral", label: "Neutre" },
  { value: "red", label: "Rouge" },
  { value: "orange", label: "Orange" },
  { value: "green", label: "Vert" },
  { value: "teal", label: "Sarcelle" },
  { value: "blue", label: "Bleu" },
  { value: "purple", label: "Violet" },
  { value: "info", label: "Info" },
] as const;

export type TagColorValue = (typeof TAG_COLOR_OPTIONS)[number]["value"];

export type WorkspaceTag = {
  id: string;
  name: string;
  color: string;
  itemCount?: number;
};
