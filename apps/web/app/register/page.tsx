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
  Text,
  useKumoToastManager,
} from "@cloudflare/kumo";
import { UserPlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AuthCard, AuthSocialButtons } from "@/components/shell/auth-card";
import { usePublicInstance } from "@/components/shell/use-public-instance";

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
  const { registrationEnabled, loaded } = usePublicInstance();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("errors.passwordsDontMatch"));
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await publicAuthClient.signUp.email({ name, email, password });
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
    await publicAuthClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
  }

  return (
    <AuthCard title={t("title")} description={t("tagline")}>
      {loaded && !registrationEnabled ? (
        <div className="grid gap-5">
          <Banner
            variant="alert"
            size="sm"
            title={t("disabledTitle")}
            description={t("disabledDescription")}
          />
          <Text variant="secondary">
            {t("alreadyHaveAccount")} <Link href="/login">{t("signIn")}</Link>
          </Text>
        </div>
      ) : (
        <div className="grid gap-5">
        <AuthSocialButtons
          githubLabel={tLogin("continueWithGithub")}
          googleLabel={tLogin("continueWithGoogle")}
          onGithub={() => handleSocialSignUp("github")}
          onGoogle={() => handleSocialSignUp("google")}
        />

        <div className="grid gap-4">
          <Text variant="secondary">{tLogin("orEmail")}</Text>

          <form onSubmit={handleSubmit} className="grid gap-4">
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
            <SensitiveInput
              size="sm"
              label={tLogin("passwordLabel")}
              value={password}
              onValueChange={setPassword}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <SensitiveInput
              size="sm"
              label={t("confirmPasswordLabel")}
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              required
              autoComplete="new-password"
              minLength={8}
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
              icon={submitting ? undefined : UserPlusIcon}
              className="w-full justify-center"
            >
              {submitting ? (
                <>
                  <Loader size="sm" />
                  {t("creating")}
                </>
              ) : (
                t("createAccount")
              )}
            </Button>
          </form>
        </div>

        <Text variant="secondary">
          {t("alreadyHaveAccount")} <Link href="/login">{t("signIn")}</Link>
        </Text>
        </div>
      )}
    </AuthCard>
  );
}
