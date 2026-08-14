import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, multiSession, organization, twoFactor } from "better-auth/plugins";
import { db, provisionPersonalWorkspace, provisionOrganizationWorkspace, eq } from "@filecloud/db";
import * as schema from "@filecloud/db";

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

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailAndPassword: {
    enabled: true,
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
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "mock-github-client-id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "mock-github-client-secret",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "mock-google-client-secret",
    },
  },
  plugins: [
    admin(),
    twoFactor({
      issuer: "Layera",
    }),
    multiSession({
      maximumSessions: 5,
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // Log OTP code for local development / S3 notification integration
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
  databaseHooks: {
    user: {
      create: {
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
