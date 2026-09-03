import { describe, expect, it } from "vitest";
import { isSafeItemName, toZipEntryName } from "./item-name";

describe("isSafeItemName", () => {
  it("accepts ordinary names", () => {
    expect(isSafeItemName("rapport final.pdf")).toBe(true);
    expect(isSafeItemName("Été 2026 — notes.md")).toBe(true);
    expect(isSafeItemName("..hidden")).toBe(true);
  });

  it("rejects empty and over-long names", () => {
    expect(isSafeItemName("")).toBe(false);
    expect(isSafeItemName("a".repeat(256))).toBe(false);
  });

  it("rejects traversal segments", () => {
    expect(isSafeItemName(".")).toBe(false);
    expect(isSafeItemName("..")).toBe(false);
  });

  it("rejects path separators", () => {
    expect(isSafeItemName("../../etc/passwd")).toBe(false);
    expect(isSafeItemName("evil/../nested")).toBe(false);
    expect(isSafeItemName("windows\\system32")).toBe(false);
  });

  it("rejects control characters", () => {
    expect(isSafeItemName("head\r\nX-Injected: 1")).toBe(false);
    expect(isSafeItemName("nul\u0000byte")).toBe(false);
  });
});

describe("toZipEntryName", () => {
  it("keeps safe names untouched", () => {
    expect(toZipEntryName("rapport.pdf")).toBe("rapport.pdf");
  });

  it("neutralises separators and traversal", () => {
    expect(toZipEntryName("../../outside.txt")).toBe(".._.._outside.txt");
    expect(toZipEntryName("a\\b")).toBe("a_b");
    expect(toZipEntryName("..")).toBe("unnamed");
  });

  it("strips control characters and falls back when nothing remains", () => {
    expect(toZipEntryName("a\r\nb")).toBe("ab");
    expect(toZipEntryName("\u0000")).toBe("unnamed");
  });
});
