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
} from "@cloudflare/kumo";
import { UserPlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AuthCard, AuthSocialButtons } from "@/components/shell/auth-card";
import { usePublicInstance } from "@/components/shell/use-public-instance";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useAuthFeedback } from "@/lib/use-auth-feedback";

export default function RegisterPage() {
  const router = useRouter();
  const { run, showError, toasts } = useAuthFeedback();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations("registerPage");
  const tLogin = useTranslations("loginPage");
  const { registrationEnabled, loaded, githubEnabled, googleEnabled } = usePublicInstance();

  const timeoutMessages = {
    errorTitle: t("toasts.errorTitle"),
    timeoutTitle: t("toasts.timeoutTitle"),
    timeoutDescription: t("toasts.timeoutDescription"),
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      const message = t("errors.passwordsDontMatch");
      setError(message);
      showError(t("toasts.errorTitle"), message);
      return;
    }

    setSubmitting(true);
    const { errorMessage } = await run(
      () => publicAuthClient.signUp.email({ name, email, password }),
      { ...timeoutMessages, fallbackError: t("errors.signUpFailed") },
    );
    setSubmitting(false);

    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    toasts.add({
      title: t("toasts.accountCreatedTitle"),
      description: t("toasts.accountCreatedDescription"),
    });
    router.push("/dashboard");
  }

  async function handleSocialSignUp(provider: "github" | "google") {
    setError(null);
    toasts.add({
      title: t("toasts.oauthSignUpTitle"),
      description: t("toasts.oauthSignUpDescription", { provider: provider === "github" ? "GitHub" : "Google" }),
    });
    const { errorMessage } = await run(
      () =>
        publicAuthClient.signIn.social({
          provider,
          callbackURL: "/dashboard",
        }),
      { ...timeoutMessages, fallbackError: t("errors.signUpFailed") },
    );
    if (errorMessage) {
      setError(errorMessage);
    }
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
          githubEnabled={githubEnabled}
          googleEnabled={googleEnabled}
          onGithub={() => handleSocialSignUp("github")}
          onGoogle={() => handleSocialSignUp("google")}
        />

        <div className="grid gap-4">
          {githubEnabled || googleEnabled ? <Text variant="secondary">{tLogin("orEmail")}</Text> : null}

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
              minLength={MIN_PASSWORD_LENGTH}
            />
            <SensitiveInput
              size="sm"
              label={t("confirmPasswordLabel")}
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
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
