import { describe, expect, it } from "vitest";
import { MAX_ZIP_DEPTH, sanitizeZipDirPath, sanitizeZipEntryPath } from "./zip-path";

describe("sanitizeZipEntryPath", () => {
  it("accepts nested relative paths", () => {
    expect(sanitizeZipEntryPath("docs/readme.md")).toEqual({ dirPath: "docs", fileName: "readme.md" });
    expect(sanitizeZipEntryPath("readme.md")).toEqual({ dirPath: "", fileName: "readme.md" });
  });

  it("rejects traversal, absolute, and null-byte paths", () => {
    expect(sanitizeZipEntryPath("../etc/passwd")).toBeNull();
    expect(sanitizeZipEntryPath("foo/../../bar")).toBeNull();
    expect(sanitizeZipEntryPath("/etc/passwd")).toBeNull();
    expect(sanitizeZipEntryPath("C:/windows/win.ini")).toBeNull();
    expect(sanitizeZipEntryPath("foo/\0bar")).toBeNull();
  });

  it("rejects control characters and over-long segments", () => {
    expect(sanitizeZipEntryPath("docs/a\r\nb.md")).toBeNull();
    expect(sanitizeZipEntryPath(`docs/${"a".repeat(256)}.md`)).toBeNull();
  });

  it("rejects paths nested deeper than the limit", () => {
    const segments = (count: number) => Array.from({ length: count }, (_, i) => `d${i}`).join("/");
    expect(sanitizeZipDirPath(segments(MAX_ZIP_DEPTH))).not.toBeNull();
    expect(sanitizeZipDirPath(segments(MAX_ZIP_DEPTH + 1))).toBeNull();
    expect(sanitizeZipEntryPath(`${segments(MAX_ZIP_DEPTH)}/file.md`)).toBeNull();
  });
});
