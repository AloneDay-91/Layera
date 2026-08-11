import { createHmac, timingSafeEqual } from "crypto";

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required");
  }
  return secret;
}

export function shareUnlockCookieName(token: string): string {
  return `share_unlock_${token}`;
}

export function signShareUnlock(token: string): string {
  return createHmac("sha256", getSigningSecret()).update(token).digest("hex");
}

export function verifyShareUnlock(token: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;

  const expected = Buffer.from(signShareUnlock(token), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(cookieValue, "hex");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
