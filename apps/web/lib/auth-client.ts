import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { publicAuthBaseUrl } from "./auth-base-url";
import { ac, authRoles } from "./auth-permissions";

export const authClient = createAuthClient({
  baseURL: publicAuthBaseUrl(),
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
