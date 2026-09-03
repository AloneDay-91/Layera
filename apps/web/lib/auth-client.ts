import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { ac, authRoles } from "./auth-permissions";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
  plugins: [
    adminClient({
      ac,
      roles: authRoles,
    }),
    emailOTPClient(),
    organizationClient(),
    multiSessionClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/login/two-factor";
      },
    }),
  ],
});
