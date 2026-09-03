export function publicAuthBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (configured) {
    return configured;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}
