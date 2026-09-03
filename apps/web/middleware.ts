import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// The browser uploads straight to the object store with a presigned PUT when
// S3_PUBLIC_ENDPOINT is configured, so that origin has to be reachable.
function connectSources(): string {
  const endpoint = process.env.S3_PUBLIC_ENDPOINT?.trim();
  if (!endpoint) return "'self'";
  try {
    return `'self' ${new URL(endpoint).origin}`;
  } catch {
    return "'self'";
  }
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // strict-dynamic lets the nonced Next.js bootstrap load its own chunks
    // without having to allowlist every hashed filename. Dev needs eval for
    // React Refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`.trim(),
    // Tailwind and Kumo set inline style attributes; there is no nonce path
    // for those, and inline styles are not an script execution vector here.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources()}${isDev ? " ws: wss:" : ""}`,
    // PDF previews render /api/files/content in an iframe.
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/dashboard") && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
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
