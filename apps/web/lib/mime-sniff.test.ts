import { describe, expect, it } from "vitest";
import { mimeMatchesDeclaration, sniffMime } from "./mime-sniff";

describe("sniffMime", () => {
  it("detects PNG, JPEG, GIF, PDF, ZIP and WebP", () => {
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from("GIF89a"))).toBe("image/gif");
    expect(sniffMime(Buffer.from("%PDF-1.4"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");

    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(sniffMime(webp)).toBe("image/webp");
  });

  it("rejects a PNG declared as JPEG", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(mimeMatchesDeclaration("image/jpeg", png)).toBe(false);
    expect(mimeMatchesDeclaration("image/png", png)).toBe(true);
  });

  it("does not enforce unknown MIME types", () => {
    expect(mimeMatchesDeclaration("application/octet-stream", Buffer.from("hello"))).toBe(true);
    expect(mimeMatchesDeclaration("text/plain", Buffer.from("hello"))).toBe(true);
  });
});
