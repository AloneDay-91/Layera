import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { ac, authRoles } from "./auth-permissions";
import { authClientBaseURL } from "./auth-client-base-url";

export const authClient = createAuthClient({
  baseURL: authClientBaseURL,
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
