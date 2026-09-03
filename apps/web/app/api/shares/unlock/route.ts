import { NextResponse } from "next/server";
import { db, shareLink, eq } from "@filecloud/db";
import { MAX_SHARE_PASSWORD_LENGTH, verifySharePassword } from "@/lib/share-password";
import { shareUnlockCookieName, signShareUnlock } from "@/lib/share-unlock";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

const UNLOCK_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

// Deliberately identical for "no such link" and "wrong password" so the
// endpoint cannot be used to tell active password-protected links apart.
function rejected() {
  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (typeof token !== "string" || !token || typeof password !== "string") {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }
    if (password.length > MAX_SHARE_PASSWORD_LENGTH) {
      return rejected();
    }

    // Keyed on the link first: the IP bucket alone is useless against an
    // attacker who can rotate addresses, and useless to honest visitors
    // sharing a NAT when no trusted proxy reports their address.
    for (const key of [`share-unlock:${token}`, `share-unlock:${token}:${getClientIp(request)}`]) {
      const { allowed, retryAfter } = await checkRateLimit(key, { windowSeconds: 60, max: 5 });
      if (!allowed) return rateLimitedResponse(retryAfter!);
    }

    const [sRecord] = await db.select().from(shareLink).where(eq(shareLink.token, token)).limit(1);

    if (
      !sRecord ||
      sRecord.revokedAt ||
      (sRecord.expiresAt && sRecord.expiresAt < new Date()) ||
      !sRecord.passwordHash
    ) {
      return rejected();
    }

    if (!verifySharePassword(password, sRecord.passwordHash)) {
      return rejected();
    }

    const secondsUntilExpiry = sRecord.expiresAt
      ? Math.floor((sRecord.expiresAt.getTime() - Date.now()) / 1000)
      : UNLOCK_COOKIE_MAX_AGE_SECONDS;

    const response = NextResponse.json({ success: true });
    response.cookies.set(shareUnlockCookieName(token), signShareUnlock(token, sRecord.passwordHash), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(1, Math.min(UNLOCK_COOKIE_MAX_AGE_SECONDS, secondsUntilExpiry)),
    });
    return response;
  } catch (error) {
    console.error("[POST /api/shares/unlock Error]:", error);
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
}
