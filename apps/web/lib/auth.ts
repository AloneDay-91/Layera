import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, multiSession, organization, twoFactor } from "better-auth/plugins";
import { db, provisionPersonalWorkspace, provisionOrganizationWorkspace, eq } from "@filecloud/db";
import * as schema from "@filecloud/db";
import { APIError } from "better-auth/api";
import { assertRegistrationAllowed } from "./services/instance-settings";
import { ServiceError } from "./services/errors";
import { ADMIN_PLUGIN_ROLES, ac, authRoles } from "./auth-permissions";

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

// Promotes users whose email is listed in ADMIN_EMAILS to the "admin" role.
// Runs on every login so it also retroactively promotes existing accounts —
// there is no other bootstrap mechanism for the very first admin.
async function syncAdminRoleForUser(userId: string) {
  if (ADMIN_EMAILS.size === 0) return;

  const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!user) return;

  const shouldBeAdmin = ADMIN_EMAILS.has(user.email.toLowerCase());
  if (shouldBeAdmin && user.role !== "admin") {
    await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, userId));
  }
}

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

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
    ...(githubClientId && githubClientSecret
      ? { github: { clientId: githubClientId, clientSecret: githubClientSecret } }
      : {}),
    ...(googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {}),
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
      async sendVerificationOTP({ email, otp, type }) {
        if (process.env.NODE_ENV === "production") {
          console.warn(`[auth] OTP requested for ${type} but no mailer is configured`);
          return;
        }
        console.log(`[Better Auth OTP - ${type}] Sending OTP to ${email}: Code ${otp}`);
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
