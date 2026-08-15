import { NextResponse } from "next/server";
import { getStoredObjectRange, getStoredObjectStream, nodeStreamToWeb } from "@filecloud/storage";

export function contentDisposition(kind: "inline" | "attachment", filename: string) {
  const encoded = encodeURIComponent(filename);
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `${kind}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function storedObjectResponse(
  storageKey: string,
  options: {
    contentType: string;
    filename: string;
    disposition: "inline" | "attachment";
    totalSize: number;
    rangeHeader?: string | null;
    extraHeaders?: Record<string, string>;
  },
) {
  const baseHeaders: Record<string, string> = {
    "Content-Type": options.contentType,
    "Content-Disposition": contentDisposition(options.disposition, options.filename),
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
    ...options.extraHeaders,
  };

  const totalSize = options.totalSize;
  const rangeHeader = options.rangeHeader;

  if (rangeHeader && totalSize > 0) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    const rangeStart = match?.[1] ? parseInt(match[1], 10) : 0;
    const rangeEnd = match?.[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd) || rangeStart > rangeEnd || rangeStart >= totalSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }

    const clampedEnd = Math.min(rangeEnd, totalSize - 1);
    const chunkLength = clampedEnd - rangeStart + 1;
    const stream = await getStoredObjectRange(storageKey, rangeStart, chunkLength);

    return new NextResponse(nodeStreamToWeb(stream), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${rangeStart}-${clampedEnd}/${totalSize}`,
        "Content-Length": chunkLength.toString(),
      },
    });
  }

  const stream = await getStoredObjectStream(storageKey);
  const headers = { ...baseHeaders };
  if (totalSize > 0) headers["Content-Length"] = totalSize.toString();

  return new NextResponse(nodeStreamToWeb(stream), { headers });
}
