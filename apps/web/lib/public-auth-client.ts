import { createAuthClient } from "better-auth/react";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { publicAuthBaseUrl } from "./auth-base-url";

export const publicAuthClient = createAuthClient({
  baseURL: publicAuthBaseUrl(),
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/login/two-factor";
      },
    }),
  ],
});
