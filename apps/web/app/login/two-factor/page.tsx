"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publicAuthClient } from "@/lib/public-auth-client";
import { Button, Input, LayerCard, Link, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowRightIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export default function TwoFactorLoginPage() {
  const router = useRouter();
  const toasts = useKumoToastManager();

  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations("twoFactorPage");
  const tLogin = useTranslations("loginPage");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: verifyError } = useBackupCode
      ? await publicAuthClient.twoFactor.verifyBackupCode({ code })
      : await publicAuthClient.twoFactor.verifyTotp({ code });

    setSubmitting(false);
    if (verifyError) {
      setError(verifyError.message ?? t("errors.invalidCode"));
      return;
    }
    toasts.add({ title: tLogin("toasts.signInSuccessTitle"), description: tLogin("toasts.signInSuccessDescription") });
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LayerCard className="w-full max-w-sm px-8 py-7">
        <div className="mb-6 flex flex-col gap-1">
          <div className="mb-1 flex items-center gap-2">
            <AppLogo size={36} />
            <Text as="h1" variant="heading1" DANGEROUS_className="font-logo">
              Layera
            </Text>
          </div>
          <div className="flex items-center gap-1.5 text-kumo-info">
            <ShieldCheckIcon size={16} />
            <Text variant="secondary">{t("title")}</Text>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Text variant="secondary">
            {useBackupCode ? t("instructionsBackup") : t("instructionsTotp")}
          </Text>
          <Input
            size="sm"
            type="text"
            label={useBackupCode ? t("backupCodeLabel") : t("verificationCodeLabel")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            placeholder={useBackupCode ? "xxxxxxxxxx" : "123456"}
            maxLength={useBackupCode ? undefined : 6}
            error={error ?? undefined}
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={submitting || !code}
            icon={ArrowRightIcon}
            className="w-full justify-center"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader size="sm" /> {t("verifying")}
              </span>
            ) : (
              t("validate")
            )}
          </Button>
        </form>

        <div className="mt-4 text-center">
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
        </div>
      </LayerCard>
    </main>
  );
}
