import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { authClientBaseURL } from "./auth-client-base-url";

export const publicAuthClient = createAuthClient({
  baseURL: authClientBaseURL,
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/login/two-factor";
      },
    }),
  ],
});
