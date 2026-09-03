import { createHmac, timingSafeEqual } from "crypto";

function getSigningSecret(): string {
  const secret = process.env.SHARE_UNLOCK_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
  }
  return secret;
}

export function shareUnlockCookieName(token: string): string {
  return `share_unlock_${token}`;
}

/**
 * Binds the cookie to the password currently set on the link, so rotating or
 * removing that password immediately invalidates every unlock handed out
 * before the change.
 */
export function signShareUnlock(token: string, passwordHash: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${token}:${passwordHash}`).digest("hex");
}

export function verifyShareUnlock(
  token: string,
  passwordHash: string,
  cookieValue: string | undefined,
): boolean {
  if (!cookieValue) return false;

  const expected = Buffer.from(signShareUnlock(token, passwordHash), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(cookieValue, "hex");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
