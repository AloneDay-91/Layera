import { describe, expect, it } from "vitest";
import { sanitizeZipEntryPath } from "./zip-path";

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
});
