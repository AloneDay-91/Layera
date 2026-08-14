"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Input, LayerCard, Loader, Text } from "@cloudflare/kumo";
import { LockIcon } from "@phosphor-icons/react";

export function SharePasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const t = useTranslations("sharePasswordGate");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shares/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        setError(t("wrongPassword"));
      }
    } catch (err) {
      console.error("Unlock error:", err);
      setError(t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-kumo-base p-6 text-kumo-default">
      <LayerCard className="w-full max-w-md px-8 py-7 flex flex-col items-center text-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-kumo-tint text-kumo-info">
          <LockIcon size={36} />
        </div>

        <div>
          <Text as="h1" variant="heading2">
            {t("title")}
          </Text>
          <Text variant="secondary" DANGEROUS_className="mt-1">
            {t("description")}
          </Text>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <Input
            size="sm"
            type="password"
            label={t("passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {error && (
            <Text as="span" DANGEROUS_className="text-kumo-danger text-sm">
              {error}
            </Text>
          )}
          <Button variant="primary" size="base" type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader size="sm" /> {t("verifying")}
              </span>
            ) : (
              t("unlock")
            )}
          </Button>
        </form>
      </LayerCard>
    </div>
  );
}
