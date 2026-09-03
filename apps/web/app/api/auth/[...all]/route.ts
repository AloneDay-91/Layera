import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  assertSocialSignInAllowed,
  isSocialProviderId,
  warmSocialProviderCache,
} from "@/lib/services/social-providers";

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

function providerFromPath(pathname: string) {
  const match = pathname.match(/\/(github|google)(?:\/|$)/);
  return match?.[1] ?? null;
}

async function providerFromRequest(request: Request) {
  const fromPath = providerFromPath(new URL(request.url).pathname);
  if (isSocialProviderId(fromPath)) return fromPath;

  if (request.method !== "POST") return null;
  try {
    const body = (await request.clone().json()) as { provider?: string };
    return isSocialProviderId(body.provider) ? body.provider : null;
  } catch {
    return null;
  }
}

async function prepareAuth(request: Request) {
  await warmSocialProviderCache();
  const provider = await providerFromRequest(request);
  if (!provider) return null;
  try {
    await assertSocialSignInAllowed(provider);
    return null;
  } catch {
    return NextResponse.json({ error: "This sign-in method is disabled" }, { status: 403 });
  }
}

export async function GET(request: Request) {
  const blocked = await prepareAuth(request);
  if (blocked) return blocked;
  return authGet(request);
}

export async function POST(request: Request) {
  const blocked = await prepareAuth(request);
  if (blocked) return blocked;
  return authPost(request);
}
