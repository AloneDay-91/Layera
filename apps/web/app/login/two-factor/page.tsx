"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicAuthClient } from "@/lib/public-auth-client";
import { Banner, Button, Input, Link, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { AuthCard } from "@/components/shell/auth-card";
import { OtpCodeField } from "@/components/shell/otp-code-field";

export default function TwoFactorLoginPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations("twoFactorPage");
  const tLogin = useTranslations("loginPage");
  const tShell = useTranslations("authShell");

  async function verify(nextCode: string) {
    const trimmed = nextCode.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: verifyError } = useBackupCode
      ? await publicAuthClient.twoFactor.verifyBackupCode({ code: trimmed })
      : await publicAuthClient.twoFactor.verifyTotp({ code: trimmed });

    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? t("errors.invalidCode"));
      return;
    }
    toasts.add({ title: tLogin("toasts.signInSuccessTitle"), description: tLogin("toasts.signInSuccessDescription") });
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await verify(code);
  }

  const totpComplete = !useBackupCode && code.length === 6;
  const canSubmit = useBackupCode ? code.trim().length > 0 : totpComplete;

  return (
    <AuthCard title={t("title")} description={useBackupCode ? t("instructionsBackup") : t("instructionsTotp")}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        {useBackupCode ? (
          <Input
            size="sm"
            type="text"
            label={t("backupCodeLabel")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            placeholder="xxxxxxxxxx"
          />
        ) : (
          <OtpCodeField
            label={t("verificationCodeLabel")}
            value={code}
            onValueChange={(next) => {
              setCode(next);
              setError(null);
            }}
            onValueComplete={(next) => {
              void verify(next);
            }}
            error={Boolean(error)}
            autoFocus
            digitAriaLabel={(current, total) => tShell("digitAria", { current, total })}
          />
        )}
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
          disabled={submitting || !canSubmit}
          icon={submitting ? undefined : ArrowRightIcon}
          className="w-full justify-center"
        >
          {submitting ? (
            <>
              <Loader size="sm" />
              {t("verifying")}
            </>
          ) : (
            t("validate")
          )}
        </Button>
      </form>

      <Text variant="secondary">
        <Link
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setUseBackupCode((prev) => !prev);
            setCode("");
            setError(null);
          }}
        >
          {useBackupCode ? t("useAuthenticatorApp") : t("useBackupCode")}
        </Link>
      </Text>
    </AuthCard>
  );
}
