export const MAX_ITEM_NAME_LENGTH = 255;

// Display names are shown in the UI and reused as entry paths when a selection
// is exported as a zip. A name carrying a separator or a traversal segment
// would produce an archive that writes outside its extraction directory once
// opened by a permissive desktop tool.
const UNSAFE_NAME_PATTERN = /[/\\]|[\u0000-\u001f\u007f]/;

export function isSafeItemName(name: string): boolean {
  if (!name || name.length > MAX_ITEM_NAME_LENGTH) return false;
  if (name === "." || name === "..") return false;
  return !UNSAFE_NAME_PATTERN.test(name);
}

/**
 * Makes a stored name safe to use as a zip entry. Rows written before names
 * were validated can still hold separators, so exports sanitize defensively
 * instead of trusting the database.
 */
export function toZipEntryName(name: string): string {
  const cleaned = name.replace(/[/\\]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "");
  const trimmed = cleaned.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return "unnamed";
  return trimmed.slice(0, MAX_ITEM_NAME_LENGTH);
}
