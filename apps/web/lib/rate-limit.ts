import { randomUUID } from "crypto";
import { db, rateLimit, sql } from "@filecloud/db";

type RateLimitRule = { windowSeconds: number; max: number };

// Only a trusted reverse proxy may dictate the client IP. Honouring
// X-Forwarded-For without that guarantee lets anyone pick their own rate
// limit bucket by rotating the header, which defeats the brute-force limits
// on public endpoints such as /api/shares/unlock.
export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY !== "true") return "unknown";

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

// Atomic upsert against Better Auth's `rate_limit` table. Concurrent first
// hits (e.g. many /api/files/content thumbnail requests) used to race on
// INSERT and 500 with rate_limit_key_unique.
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;

  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`CASE
          WHEN ${now} - COALESCE(${rateLimit.lastRequest}, 0) > ${windowMs} THEN 1
          ELSE COALESCE(${rateLimit.count}, 0) + 1
        END`,
        lastRequest: sql`CASE
          WHEN ${now} - COALESCE(${rateLimit.lastRequest}, 0) > ${windowMs} THEN ${now}
          WHEN COALESCE(${rateLimit.count}, 0) >= ${rule.max} THEN ${rateLimit.lastRequest}
          ELSE ${now}
        END`,
      },
    })
    .returning();

  const count = row?.count ?? 1;
  const lastRequest = row?.lastRequest ?? now;

  if (count > rule.max) {
    const retryAfter = Math.max(1, Math.ceil((lastRequest + windowMs - now) / 1000));
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: null };
}

export function rateLimitedResponse(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "X-Retry-After": retryAfter.toString() },
  });
}
