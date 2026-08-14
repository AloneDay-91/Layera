import { NextResponse } from "next/server";
import { db, shareLink, eq } from "@filecloud/db";
import { verifySharePassword } from "@/lib/share-password";
import { shareUnlockCookieName, signShareUnlock } from "@/lib/share-unlock";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const { allowed, retryAfter } = await checkRateLimit(`share-unlock:${getClientIp(request)}`, {
      windowSeconds: 60,
      max: 5,
    });
    if (!allowed) return rateLimitedResponse(retryAfter!);

    const { token, password } = await request.json();

    if (!token || typeof password !== "string") {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }

    const [sRecord] = await db.select().from(shareLink).where(eq(shareLink.token, token)).limit(1);

    if (
      !sRecord ||
      sRecord.revokedAt ||
      (sRecord.expiresAt && sRecord.expiresAt < new Date()) ||
      !sRecord.passwordHash
    ) {
      return NextResponse.json({ error: "Share link invalid or expired" }, { status: 404 });
    }

    if (!verifySharePassword(password, sRecord.passwordHash)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(shareUnlockCookieName(token), signShareUnlock(token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    console.error("[POST /api/shares/unlock Error]:", error);
    return NextResponse.json({ error: "Failed to verify password" }, { status: 500 });
  }
}
