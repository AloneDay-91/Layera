import { presignGetObject, usesPublicPresign } from "@filecloud/storage";
import { contentDisposition } from "@/lib/http-file";
import { serveAs } from "@/lib/mime";

export const SIGNED_GET_EXPIRY_SECONDS = 2 * 60;
const INLINE_IMAGE_PREVIEW_BYTES = 512 * 1024;

/**
 * A presigned PUT does not pin the object's Content-Type, so a client can
 * store bytes under a type of its choosing — a PNG carrying a script in a
 * text chunk, labelled text/html. These overrides are part of the signature,
 * so the object is always served back under the type the server recorded and
 * anything not inert arrives as a download.
 */
function responseHeadersFor(descriptor: { mimeType: string; name: string }) {
  const served = serveAs(descriptor.mimeType);
  return {
    "response-content-type": served.contentType,
    "response-content-disposition": contentDisposition(served.disposition, descriptor.name),
  };
}

export async function signedOrProxyReadUrl(
  storageKey: string,
  proxyPath: string,
  descriptor: { mimeType: string; name: string },
) {
  if (usesPublicPresign) {
    const url = await presignGetObject(
      storageKey,
      SIGNED_GET_EXPIRY_SECONDS,
      responseHeadersFor(descriptor),
    );
    return {
      url,
      expiresAt: new Date(Date.now() + SIGNED_GET_EXPIRY_SECONDS * 1000).toISOString(),
    };
  }
  return { url: proxyPath, expiresAt: null as string | null };
}

type PreviewableFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  thumbnailKey: string | null;
};

function previewSource(file: PreviewableFile) {
  if (file.thumbnailKey) {
    return {
      key: file.thumbnailKey,
      proxyPath: `/api/files/content?id=${file.id}&variant=thumb`,
      // Thumbnails are written by the worker, never by a client.
      descriptor: { mimeType: "image/webp", name: `${file.name}.thumb.webp` },
    };
  }
  if (file.mimeType.startsWith("image/") && file.size <= INLINE_IMAGE_PREVIEW_BYTES) {
    return {
      key: file.storageKey,
      proxyPath: `/api/files/content?id=${file.id}`,
      descriptor: { mimeType: file.mimeType, name: file.name },
    };
  }
  return null;
}

export async function previewUrlsByFileId(files: PreviewableFile[]) {
  const sources = files.flatMap((file) => {
    const preview = previewSource(file);
    return preview ? [{ id: file.id, ...preview }] : [];
  });
  if (sources.length === 0) return new Map<string, string>();
  const signed = await Promise.all(
    sources.map((source) => signedOrProxyReadUrl(source.key, source.proxyPath, source.descriptor)),
  );
  return new Map(sources.map((source, index) => [source.id, signed[index]!.url]));
}
