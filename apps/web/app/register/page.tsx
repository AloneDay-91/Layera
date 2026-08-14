"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button, Input, LayerCard, Link, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import {
  GithubLogoIcon,
  GoogleLogoIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export default function RegisterPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations("registerPage");
  const tLogin = useTranslations("loginPage");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("errors.passwordsDontMatch"));
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await authClient.signUp.email({ name, email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message ?? t("errors.signUpFailed"));
      return;
    }

    toasts.add({
      title: t("toasts.accountCreatedTitle"),
      description: t("toasts.accountCreatedDescription"),
    });
    router.push("/dashboard");
  }

  async function handleSocialSignUp(provider: "github" | "google") {
    toasts.add({
      title: t("toasts.oauthSignUpTitle"),
      description: t("toasts.oauthSignUpDescription", { provider: provider === "github" ? "GitHub" : "Google" }),
    });
    await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LayerCard className="w-full max-w-sm px-8 py-7">
        {/* En-tête de marque */}
        <div className="mb-6 flex flex-col gap-1 justify-center items-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <AppLogo size={36} />
            <Text as="h1" variant="heading1" DANGEROUS_className="font-logo">
              Layera
            </Text>
          </div>
          <Text variant="secondary">{t("tagline")}</Text>
        </div>

        {/* Inscription Sociale */}
        <div className="flex flex-col gap-2 mb-6">
          <Button
            variant="secondary"
            size="sm"
            icon={GithubLogoIcon}
            onClick={() => handleSocialSignUp("github")}
            className="w-full justify-center"
          >
            {tLogin("continueWithGithub")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={GoogleLogoIcon}
            onClick={() => handleSocialSignUp("google")}
            className="w-full justify-center"
          >
            {tLogin("continueWithGoogle")}
          </Button>
        </div>

        {/* Séparateur */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="w-full border-t border-kumo-line" />
          <Text as="span" variant="secondary" DANGEROUS_className="absolute bg-kumo-base px-3">
            {tLogin("orEmail")}
          </Text>
        </div>

        {/* Formulaire classique */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            size="sm"
            label={t("nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder={t("namePlaceholder")}
          />

          <Input
            size="sm"
            type="email"
            label={tLogin("emailLabel")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={tLogin("emailPlaceholder")}
          />

          <Input
            size="sm"
            type="password"
            label={tLogin("passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />

          <Input
            size="sm"
            type="password"
            label={t("confirmPasswordLabel")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            error={error ?? undefined}
          />

          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={submitting}
            icon={UserPlusIcon}
            className="mt-2 w-full justify-center"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader size="sm" /> {t("creating")}
              </span>
            ) : (
              t("createAccount")
            )}
          </Button>
        </form>

        {/* Footer Redirection Login */}
        <div className="mt-6 text-center">
          <Text variant="secondary">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login">{t("signIn")}</Link>
          </Text>
        </div>
      </LayerCard>
    </main>
  );
}
