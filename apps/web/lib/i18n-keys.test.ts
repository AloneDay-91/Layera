import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

function dottedKeys(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const here = path ? `${path}.${key}` : key;
    const self = key.includes(".") ? [here] : [];
    return [...self, ...dottedKeys(child, here)];
  });
}

describe("i18n messages", () => {
  it("does not use dots in next-intl object keys", () => {
    expect(dottedKeys(en)).toEqual([]);
    expect(dottedKeys(fr)).toEqual([]);
  });
});
