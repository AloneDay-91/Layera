"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicAuthClient } from "@/lib/public-auth-client";
import { Button, Input, LayerCard, Link, Loader, Tabs, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  GithubLogoIcon,
  GoogleLogoIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export default function LoginPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");

  // State for Password login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State for OTP login
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const t = useTranslations("loginPage");
  const tErrors = useTranslations("loginPage.errors");
  const tToasts = useTranslations("loginPage.toasts");

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
      // La redirection vers /login/two-factor est gérée par onTwoFactorRedirect
      // dans le client Better Auth ; on n'ouvre pas de session ici.
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <LayerCard className="w-full max-w-sm px-8 py-7">
        {/* En-tête marque */}
        <div className="mb-6 flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AppLogo size={36} />
            <Text as="h1" variant="heading1" DANGEROUS_className="font-logo">
              Layera
            </Text>
          </div>
          <Text variant="secondary">{t("tagline")}</Text>
        </div>

        {/* Boutons de connexion Sociale */}
        <div className="flex flex-col gap-2 mb-6">
          <Button
            variant="secondary"
            size="sm"
            icon={GithubLogoIcon}
            onClick={() => handleSocialSignIn("github")}
            className="w-full justify-center"
          >
            {t("continueWithGithub")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={GoogleLogoIcon}
            onClick={() => handleSocialSignIn("google")}
            className="w-full justify-center"
          >
            {t("continueWithGoogle")}
          </Button>
        </div>

        {/* Séparateur */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-kumo-line" />
          <Text as="span" variant="secondary" DANGEROUS_className="absolute bg-kumo-base px-3">
            {t("orEmail")}
          </Text>
        </div>

        {/* Choix de la méthode d'authentification */}
        <div className="mb-4">
          <Tabs
            listClassName="justify-center w-full "
            variant="underline"
            size="sm"
            tabs={[
              {
                value: "password",
                label: (
                  <span className="flex items-center justify-center gap-1.5 w-full">
                    <KeyIcon size={14} /> {t("password")}
                  </span>
                ),
                className: "w-full flex items-center justify-center text-center"
              },
              {
                value: "otp",
                label: (
                  <span className="flex items-center justify-center gap-1.5 w-full">
                    <EnvelopeSimpleIcon size={14} /> {t("otp")}
                  </span>
                ),
                className: "w-full flex items-center justify-center text-center"
              },
            ]}
            value={authMethod}
            onValueChange={(val) => {
              setAuthMethod(val as "password" | "otp");
              setError(null);
            }}
          />
        </div>

        {/* Formulaire Mot de Passe */}
        {authMethod === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
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

            <Input
              size="sm"
              type="password"
              label={t("passwordLabel")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              error={error ?? undefined}
            />

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              icon={ArrowRightIcon}
              className="mt-2 w-full justify-center"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader size="sm" /> {t("signingIn")}
                </span>
              ) : (
                t("signIn")
              )}
            </Button>
          </form>
        )}

        {/* Formulaire Code OTP */}
        {authMethod === "otp" && (
          <>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <Input
                  size="sm"
                  type="email"
                  label={t("emailAddressLabel")}
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  error={error ?? undefined}
                />
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={sendingOtp}
                  icon={EnvelopeSimpleIcon}
                  className="mt-2 w-full justify-center"
                >
                  {sendingOtp ? (
                    <span className="flex items-center gap-1.5">
                      <Loader size="sm" /> {t("sendingCode")}
                    </span>
                  ) : (
                    t("receiveCodeByEmail")
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <Text variant="secondary">
                  {t("codeSentTo")} <strong className="text-kumo-strong">{otpEmail}</strong>.
                </Text>
                <Input
                  size="sm"
                  type="text"
                  label={t("otpCodeLabel")}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  placeholder="123456"
                  maxLength={6}
                  error={error ?? undefined}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 justify-center"
                  >
                    {t("change")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={submitting}
                    icon={ArrowRightIcon}
                    className="w-2/3 justify-center"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader size="sm" /> {t("verifying")}
                      </span>
                    ) : (
                      t("validateCode")
                    )}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Footer redirection vers l'inscription */}
        <div className="mt-6 text-center">
          <Text variant="secondary">
            {t("noAccountYet")}{" "}
            <Link href="/register">{t("createAccount")}</Link>
          </Text>
        </div>
      </LayerCard>
    </main>
  );
}
