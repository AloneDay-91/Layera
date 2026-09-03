"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicAuthClient } from "@/lib/public-auth-client";
import {
  Banner,
  Button,
  Input,
  Link,
  Loader,
  SensitiveInput,
  Tabs,
  Text,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { ArrowRightIcon, EnvelopeSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AuthCard, AuthSocialButtons } from "@/components/shell/auth-card";
import { OtpCodeField } from "@/components/shell/otp-code-field";
import { usePublicInstance } from "@/components/shell/use-public-instance";

export default function LoginPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const t = useTranslations("loginPage");
  const { registrationEnabled } = usePublicInstance();
  const tErrors = useTranslations("loginPage.errors");
  const tToasts = useTranslations("loginPage.toasts");
  const tShell = useTranslations("authShell");

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await publicAuthClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? tErrors("signInFailed"));
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      return;
    }
    toasts.add({ title: tToasts("signInSuccessTitle"), description: tToasts("signInSuccessDescription") });
    router.push("/dashboard");
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setSendingOtp(true);
    setError(null);
    const { error: otpError } = await publicAuthClient.emailOtp.sendVerificationOtp({
      email: otpEmail,
      type: "sign-in",
    });
    setSendingOtp(false);
    if (otpError) {
      setError(otpError.message ?? tErrors("otpSendFailed"));
      return;
    }
    setOtpSent(true);
    toasts.add({
      title: tToasts("codeSentTitle"),
      description: tToasts("codeSentDescription", { email: otpEmail }),
    });
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await publicAuthClient.signIn.emailOtp({
      email: otpEmail,
      otp: otpCode,
    });
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? tErrors("otpInvalid"));
      return;
    }
    toasts.add({ title: tToasts("otpSuccessTitle"), description: tToasts("otpSuccessDescription") });
    router.push("/dashboard");
  }

  async function handleSocialSignIn(provider: "github" | "google") {
    toasts.add({
      title: tToasts("oauthRedirectTitle"),
      description: tToasts("oauthRedirectDescription", { provider: provider === "github" ? "GitHub" : "Google" }),
    });
    await publicAuthClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <AuthCard title={t("title")} description={t("tagline")}>
      <div className="grid gap-5">
        <AuthSocialButtons
          githubLabel={t("continueWithGithub")}
          googleLabel={t("continueWithGoogle")}
          onGithub={() => handleSocialSignIn("github")}
          onGoogle={() => handleSocialSignIn("google")}
        />

        <div className="grid gap-4">
          <Text variant="secondary">{t("orEmail")}</Text>
          <Tabs
            variant="segmented"
            size="sm"
            tabs={[
              { value: "password", label: t("password") },
              { value: "otp", label: t("otp") },
            ]}
            value={authMethod}
            onValueChange={(val) => {
              setAuthMethod(val as "password" | "otp");
              setError(null);
            }}
          />

          {authMethod === "password" && (
            <form onSubmit={handlePasswordSubmit} className="grid gap-4">
              <Input
                size="sm"
                type="email"
                label={t("emailLabel")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
              />
              <SensitiveInput
                size="sm"
                label={t("passwordLabel")}
                value={password}
                onValueChange={setPassword}
                required
                autoComplete="current-password"
              />
              {error ? (
                <Banner
                  variant="error"
                  size="sm"
                  icon={<WarningCircleIcon weight="fill" />}
                  title={error}
                />
              ) : null}
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={submitting}
                icon={submitting ? undefined : ArrowRightIcon}
                className="w-full justify-center"
              >
                {submitting ? (
                  <>
                    <Loader size="sm" />
                    {t("signingIn")}
                  </>
                ) : (
                  t("signIn")
                )}
              </Button>
            </form>
          )}

          {authMethod === "otp" && !otpSent && (
            <form onSubmit={handleSendOtp} className="grid gap-4">
              <Input
                size="sm"
                type="email"
                label={t("emailAddressLabel")}
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
              />
              {error ? (
                <Banner
                  variant="error"
                  size="sm"
                  icon={<WarningCircleIcon weight="fill" />}
                  title={error}
                />
              ) : null}
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={sendingOtp}
                icon={sendingOtp ? undefined : EnvelopeSimpleIcon}
                className="w-full justify-center"
              >
                {sendingOtp ? (
                  <>
                    <Loader size="sm" />
                    {t("sendingCode")}
                  </>
                ) : (
                  t("receiveCodeByEmail")
                )}
              </Button>
            </form>
          )}

          {authMethod === "otp" && otpSent && (
            <form onSubmit={handleVerifyOtp} className="grid gap-4">
              <Text variant="secondary">
                {t("codeSentTo")}{" "}
                <Text as="strong" bold>
                  {otpEmail}
                </Text>
                .
              </Text>
              <OtpCodeField
                label={t("otpCodeLabel")}
                value={otpCode}
                onValueChange={(next) => {
                  setOtpCode(next);
                  setError(null);
                }}
                error={Boolean(error)}
                autoFocus
                digitAriaLabel={(current, total) => tShell("digitAria", { current, total })}
              />
              {error ? (
                <Banner
                  variant="error"
                  size="sm"
                  icon={<WarningCircleIcon weight="fill" />}
                  title={error}
                />
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="justify-center"
                >
                  {t("change")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={submitting || otpCode.length !== 6}
                  icon={submitting ? undefined : ArrowRightIcon}
                  className="col-span-2 justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader size="sm" />
                      {t("verifying")}
                    </>
                  ) : (
                    t("validateCode")
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {registrationEnabled ? (
          <Text variant="secondary">
            {t("noAccountYet")} <Link href="/register">{t("createAccount")}</Link>
          </Text>
        ) : null}
      </div>
    </AuthCard>
  );
}
