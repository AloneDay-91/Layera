import { presignGetObject, usesPublicPresign } from "@filecloud/storage";

export const SIGNED_GET_EXPIRY_SECONDS = 2 * 60;
const INLINE_IMAGE_PREVIEW_BYTES = 512 * 1024;

export async function signedOrProxyReadUrl(storageKey: string, proxyPath: string) {
  if (usesPublicPresign) {
    const url = await presignGetObject(storageKey, SIGNED_GET_EXPIRY_SECONDS);
    return {
      url,
      expiresAt: new Date(Date.now() + SIGNED_GET_EXPIRY_SECONDS * 1000).toISOString(),
    };
  }
  return { url: proxyPath, expiresAt: null as string | null };
}

type PreviewableFile = {
  id: string;
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
    };
  }
  if (file.mimeType.startsWith("image/") && file.size <= INLINE_IMAGE_PREVIEW_BYTES) {
    return {
      key: file.storageKey,
      proxyPath: `/api/files/content?id=${file.id}`,
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
    sources.map((source) => signedOrProxyReadUrl(source.key, source.proxyPath)),
  );
  return new Map(sources.map((source, index) => [source.id, signed[index]!.url]));
}
