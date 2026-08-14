"use client";

import { useTranslations } from "next-intl";
import { Button } from "@cloudflare/kumo";
import { DownloadSimpleIcon } from "@phosphor-icons/react";

export function ShareDownloadButton({ href, filename }: { href: string; filename: string }) {
  const t = useTranslations("shareDownloadButton");

  return (
    <a href={href} download={filename} className="w-full">
      <Button variant="primary" size="base" className="w-full" icon={DownloadSimpleIcon}>
        {t("download")}
      </Button>
    </a>
  );
}
