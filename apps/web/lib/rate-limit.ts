import { randomUUID } from "crypto";
import { db, rateLimit, eq } from "@filecloud/db";

type RateLimitRule = { windowSeconds: number; max: number };

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Read-then-write against a shared Postgres table (reuses Better Auth's own
// `rate_limit` schema/table). Not perfectly atomic under heavy concurrency,
// but sufficient as an abuse guard on our own routes (upload, share creation,
// share password unlock) — Better Auth's built-in limiter only covers its
// own auth endpoints, not these custom ones.
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;

  const [existing] = await db.select().from(rateLimit).where(eq(rateLimit.key, key)).limit(1);

  if (!existing) {
    await db.insert(rateLimit).values({ id: randomUUID(), key, count: 1, lastRequest: now });
    return { allowed: true, retryAfter: null };
  }

  const lastRequest = existing.lastRequest ?? 0;
  if (now - lastRequest > windowMs) {
    await db.update(rateLimit).set({ count: 1, lastRequest: now }).where(eq(rateLimit.key, key));
    return { allowed: true, retryAfter: null };
  }

  const count = existing.count ?? 0;
  if (count >= rule.max) {
    const retryAfter = Math.max(1, Math.ceil((lastRequest + windowMs - now) / 1000));
    return { allowed: false, retryAfter };
  }

  await db.update(rateLimit).set({ count: count + 1, lastRequest: now }).where(eq(rateLimit.key, key));
  return { allowed: true, retryAfter: null };
}

export function rateLimitedResponse(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "X-Retry-After": retryAfter.toString() },
  });
}
