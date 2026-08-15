import { presignGetObject, usesPublicPresign } from "@filecloud/storage";

export const SIGNED_GET_EXPIRY_SECONDS = 2 * 60;

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
