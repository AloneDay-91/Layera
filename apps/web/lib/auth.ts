import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, multiSession, organization, twoFactor } from "better-auth/plugins";
import { db, provisionPersonalWorkspace, provisionOrganizationWorkspace, eq, sql } from "@filecloud/db";
import * as schema from "@filecloud/db";
import { APIError } from "better-auth/api";
import { assertRegistrationAllowed } from "./services/instance-settings";
import { peekSocialProvider } from "./services/social-providers";
import { ServiceError } from "./services/errors";
import { ADMIN_PLUGIN_ROLES, ac, authRoles } from "./auth-permissions";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password-policy";

const SOCIAL_PLACEHOLDER = "unconfigured";

function socialProviderOptions(id: "github" | "google") {
  return {
    get clientId() {
      return peekSocialProvider(id).clientId || SOCIAL_PLACEHOLDER;
    },
    get clientSecret() {
      return peekSocialProvider(id).clientSecret || SOCIAL_PLACEHOLDER;
    },
  };
}

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

async function instanceHasAdmin(): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.user)
    .where(eq(schema.user.role, "admin"));
  return Number(row?.count ?? 0) > 0;
}

// Promotes users whose email is listed in ADMIN_EMAILS to the "admin" role.
// Runs on every login so it also retroactively promotes existing accounts —
// there is no other bootstrap mechanism for the very first admin.
//
// Listing an address is not proof of owning it. Once the instance has an
// admin, promotion requires a verified email (which social sign-in provides),
// so an attacker who registers a listed address with email/password cannot
// hand themselves the admin panel. Removing an address from the list does not
// demote anyone: roles are also granted from the admin UI, and revoking them
// belongs there.
async function syncAdminRoleForUser(userId: string) {
  if (ADMIN_EMAILS.size === 0) return;

  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!user) return;
  if (user.role === "admin") return;
  if (!ADMIN_EMAILS.has(user.email.toLowerCase())) return;

  if (!user.emailVerified && (await instanceHasAdmin())) {
    console.warn(
      `[auth] Refusing to promote ${user.email} from ADMIN_EMAILS: the address is not verified and this instance already has an admin. Grant the role from the admin panel instead.`,
    );
    return;
  }

  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, userId));
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // Self-hosted MVP has no mailer yet; turn this on when sendVerificationOTP
    // actually delivers mail, otherwise sign-up locks users out.
    requireEmailVerification: false,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    // Slides the expiry at most once a day so a stolen cookie cannot be kept
    // alive indefinitely by a background tab.
    updateAge: 60 * 60 * 24,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 10, max: 5 },
      "/sign-in/email-otp": { window: 10, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/two-factor/verify-totp": { window: 10, max: 5 },
      "/two-factor/verify-otp": { window: 10, max: 5 },
      "/two-factor/verify-backup-code": { window: 10, max: 5 },
    },
  },
  socialProviders: {
    github: socialProviderOptions("github"),
    google: socialProviderOptions("google"),
  },
  plugins: [
    admin({
      ac,
      roles: authRoles,
      adminRoles: [...ADMIN_PLUGIN_ROLES],
      defaultRole: "user",
    }),
    twoFactor({
      issuer: "Layera",
    }),
    multiSession({
      maximumSessions: 5,
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp, type }) {
        // A logged one-time code is a complete authentication bypass for
        // anyone who can read the logs, so printing it takes a deliberate
        // opt-in and is never available on a production build.
        if (process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG_OTP === "true") {
          console.log(`[auth] OTP for ${type} to ${email}: ${otp}`);
          return;
        }
        console.warn(`[auth] OTP requested for ${type} but no mailer is configured`);
      },
    }),
    organization({
      teams: {
        enabled: true,
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          await provisionOrganizationWorkspace({
            organizationId: organization.id,
            name: organization.name,
            ownerId: user.id,
          });
        },
      },
    }),
  ],
  secret: betterAuthSecret,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_BETTER_AUTH_URL].filter(
    (value): value is string => Boolean(value),
  ),
  advanced: {
    // Otherwise the flag is only inferred from BETTER_AUTH_URL, and the app is
    // documented as binding loopback behind a TLS proxy — an http:// value
    // there is plausible and would silently ship the session cookie without
    // Secure. Browsers treat localhost as a secure context, so local testing
    // is unaffected; a plain-HTTP deployment has to opt out on purpose.
    useSecureCookies:
      process.env.NODE_ENV === "production" && process.env.AUTH_ALLOW_INSECURE_COOKIES !== "true",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          try {
            await assertRegistrationAllowed();
          } catch (error) {
            if (error instanceof ServiceError) {
              throw new APIError("FORBIDDEN", { message: error.message });
            }
            throw error;
          }
          return { data: user };
        },
        after: async (user) => {
          await provisionPersonalWorkspace({ userId: user.id, userName: user.name });
          await syncAdminRoleForUser(user.id);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await syncAdminRoleForUser(session.userId);
        },
      },
    },
  },
});
