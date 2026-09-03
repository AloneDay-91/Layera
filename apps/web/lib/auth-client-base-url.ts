/**
 * Base URL the browser sends auth requests to.
 *
 * NEXT_PUBLIC_* values are inlined into the client bundle when the app is
 * built, not read when it runs, so a hardcoded fallback would ship inside the
 * published image and override whatever the operator configures. Falling back
 * to "http://localhost:3000" meant a visitor's browser posted its credentials
 * to its own machine. Leaving this undefined makes Better Auth use the page's
 * origin, which is where /api/auth is always mounted; the variable stays only
 * as an escape hatch for an instance that really serves auth elsewhere, and it
 * has to be set at build time to take effect.
 */
export const authClientBaseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || undefined;
