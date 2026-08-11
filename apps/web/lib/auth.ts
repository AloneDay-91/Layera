import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, organization } from "better-auth/plugins";
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
