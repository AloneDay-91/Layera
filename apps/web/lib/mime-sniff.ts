const SIGNATURES: Array<{ mime: string; bytes: number[] | number[][] }> = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

const DECLARED_TYPES_TO_VERIFY = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
]);

function matches(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

export function sniffMime(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.mime === "image/webp") {
      if (matches(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.length >= 12) {
        if (buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
      }
      continue;
    }
    if (matches(buffer, signature.bytes as number[])) return signature.mime;
  }
  return null;
}

/** Rejects a client-declared MIME when the file magic clearly contradicts it. */
export function mimeMatchesDeclaration(declaredMime: string, prefix: Buffer): boolean {
  if (!DECLARED_TYPES_TO_VERIFY.has(declaredMime)) return true;
  const sniffed = sniffMime(prefix);
  if (!sniffed) return false;
  return sniffed === declaredMime;
}
