import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

function originOf(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

// When S3_PUBLIC_ENDPOINT is configured the browser talks to the object store
// directly: presigned PUT for uploads, presigned GET for every preview. That
// origin therefore has to be reachable as a fetch, image, media and frame
// source, otherwise previews break.
function storageOrigin(): string | null {
  return originOf(process.env.S3_PUBLIC_ENDPOINT);
}

// The auth client calls its configured base URL as an absolute address, so an
// instance whose auth URL is not the page's own origin needs it allowed
// explicitly. Deployments where both match land on 'self' and add nothing.
function authOrigins(): string[] {
  const origins = [
    originOf(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
    originOf(process.env.BETTER_AUTH_URL),
  ].filter((origin): origin is string => Boolean(origin));
  return [...new Set(origins)];
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const storage = storageOrigin();
  // Every directive that can point at stored bytes gets the object store.
  const withStorage = (...sources: string[]) =>
    [...new Set([...sources, ...(storage ? [storage] : [])])].join(" ");

  return [
    "default-src 'self'",
    // strict-dynamic lets the nonced Next.js bootstrap load its own chunks
    // without having to allowlist every hashed filename. Dev needs eval for
    // React Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`.trim(),
    // Tailwind and Kumo set inline style attributes; there is no nonce path
    // for those, and inline styles are not an script execution vector here.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${withStorage("'self'", "data:", "blob:")}`,
    `media-src ${withStorage("'self'", "blob:")}`,
    "font-src 'self' data:",
    `connect-src ${withStorage("'self'", ...authOrigins())}${isDev ? " ws: wss:" : ""}`,
    // PDF previews frame either the presigned URL or /api/files/content.
    `frame-src ${withStorage("'self'", "blob:")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // The API renders no documents, and the routes that stream stored bytes ship
  // a far stricter policy of their own ("default-src 'none'; sandbox"). Setting
  // the document policy here would overwrite it.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  // Next reads the nonce off the request headers to stamp its own script tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own static output and public assets, which are
    // served verbatim and need no policy.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)",
  ],
};
