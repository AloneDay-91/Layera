"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import type { UpdatesResponse } from "@/lib/updates";

export function VersionCheck({ version }: { version: string }) {
  const t = useTranslations("versionCheck");
  const toasts = useKumoToastManager();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/updates?refresh=1");
      if (res.status === 403) {
        toasts.add({ title: t("errorTitle"), description: t("forbidden") });
        return;
      }
      if (!res.ok) {
        toasts.add({ title: t("errorTitle"), description: t("errorDescription") });
        return;
      }
      const data = (await res.json()) as UpdatesResponse;
      if (data.upToDate) {
        const message = t("upToDate", { current: data.current });
        setStatus(message);
        toasts.add({ title: t("upToDateTitle"), description: message });
        return;
      }
      const message = t("available", { latest: data.latest });
      setStatus(message);
      toasts.add({ title: t("availableTitle"), description: message });
    } catch {
      toasts.add({ title: t("errorTitle"), description: t("errorDescription") });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Text as="span">{version || "—"}</Text>
        <Button
          variant="secondary"
          size="sm"
          icon={checking ? undefined : ArrowsClockwiseIcon}
          onClick={handleCheck}
          disabled={checking}
          aria-label={t("checkAria")}
        >
          {checking ? (
            <span className="flex items-center gap-1.5">
              <Loader size="sm" />
              {t("checking")}
            </span>
          ) : (
            t("check")
          )}
        </Button>
      </div>
      {status ? (
        <Text as="span" variant="secondary">
          {status}
        </Text>
      ) : null}
    </div>
  );
}
