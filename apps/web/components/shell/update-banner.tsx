"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Banner, useKumoToastManager } from "@cloudflare/kumo";
import { ArrowSquareOutIcon, CopyIcon, InfoIcon, XIcon } from "@phosphor-icons/react";
import { DISMISSED_UPDATE_KEY, type UpdatesResponse } from "@/lib/updates";

export function UpdateBanner() {
  const t = useTranslations("updateBanner");
  const toasts = useKumoToastManager();
  const [update, setUpdate] = useState<Extract<UpdatesResponse, { upToDate: false }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/updates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UpdatesResponse | null) => {
        if (cancelled || !data || data.upToDate) return;
        const dismissed = window.localStorage.getItem(DISMISSED_UPDATE_KEY);
        if (dismissed === data.tag) return;
        setUpdate(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;

  const available = update;

  function dismiss() {
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, available.tag);
    setUpdate(null);
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(available.composeCommand);
      toasts.add({ title: t("copiedTitle"), description: t("copiedDescription") });
    } catch {
      toasts.add({ title: t("copyErrorTitle"), description: t("copyErrorDescription") });
    }
  }

  return (
    <div className="px-4 pt-4">
      <Banner
        variant="default"
        size="sm"
        icon={<InfoIcon weight="fill" />}
        title={t("title", { latest: available.latest })}
        description={t("description", { current: available.current })}
        action={
          <>
            <Banner.Action
              icon={ArrowSquareOutIcon}
              onClick={() => window.open(available.htmlUrl, "_blank", "noopener,noreferrer")}
            >
              {t("viewRelease")}
            </Banner.Action>
            <Banner.Action variant="secondary" icon={CopyIcon} onClick={copyCommand}>
              {t("copyCommand")}
            </Banner.Action>
            <Banner.Action variant="ghost" icon={XIcon} aria-label={t("dismissAria")} onClick={dismiss} />
          </>
        }
      />
    </div>
  );
}
