import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// scrypt is deliberately expensive, so an unbounded password would let a
// single unlock request pin a CPU core for seconds.
export const MAX_SHARE_PASSWORD_LENGTH = 128;

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
  if (password.length > MAX_SHARE_PASSWORD_LENGTH) return false;

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = scryptSync(password, salt, 64);
  if (candidateBuffer.length !== hashBuffer.length) return false;

  return timingSafeEqual(candidateBuffer, hashBuffer);
}
