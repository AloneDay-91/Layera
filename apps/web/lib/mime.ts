const EXTENSION_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  json: "application/json",
  zip: "application/zip",
  js: "text/javascript",
  ts: "text/plain",
  tsx: "text/plain",
  jsx: "text/plain",
};

// Types the browser will happily execute in the app's own origin if they ever
// escape the download path. Kept out of storage entirely rather than relying
// on the response headers alone.
export const BLOCKED_UPLOAD_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "text/css",
  "application/x-msdownload",
]);

/**
 * Drops parameters and casing so `TEXT/HTML` and `text/html; charset=utf-8`
 * cannot walk straight past a denylist keyed on the bare type.
 */
export function normalizeMimeType(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
}

export function isBlockedUploadMimeType(value: string | null | undefined): boolean {
  return BLOCKED_UPLOAD_MIME_TYPES.has(normalizeMimeType(value));
}

// SVG and HTML are deliberately absent — they can embed <script> and execute it
// when the browser navigates straight to them, unlike raster, media and plain
// text formats.
const INLINE_SAFE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

/**
 * How stored bytes may be served back, derived from the type the server
 * recorded at upload time. Anything not known to be inert is relabelled and
 * pushed to a download, so a file the browser would execute cannot be rendered
 * from a URL of ours.
 */
export function serveAs(mimeType: string | null | undefined): {
  contentType: string;
  disposition: "inline" | "attachment";
} {
  const normalized = normalizeMimeType(mimeType);
  return INLINE_SAFE_MIME_TYPES.has(normalized)
    ? { contentType: normalized, disposition: "inline" }
    : { contentType: "application/octet-stream", disposition: "attachment" };
}

export function getMimeTypeFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TO_MIME[ext] ?? "application/octet-stream";
}
