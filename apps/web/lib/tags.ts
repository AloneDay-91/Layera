export const TAG_COLOR_OPTIONS = [
  { value: "neutral" },
  { value: "red" },
  { value: "orange" },
  { value: "green" },
  { value: "teal" },
  { value: "blue" },
  { value: "purple" },
  { value: "info" },
] as const;

export type TagColorValue = (typeof TAG_COLOR_OPTIONS)[number]["value"];

export type WorkspaceTag = {
  id: string;
  name: string;
  color: string;
  itemCount?: number;
};
