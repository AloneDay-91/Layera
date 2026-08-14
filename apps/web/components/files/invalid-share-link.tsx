"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, LayerCard, Text } from "@cloudflare/kumo";
import { LinkBreakIcon } from "@phosphor-icons/react";

export function InvalidShareLink() {
  const t = useTranslations("invalidShareLink");

  return (
    <div className="flex min-h-screen items-center justify-center bg-kumo-base p-6 text-kumo-default">
      <LayerCard className="w-full max-w-md px-8 py-7 flex flex-col items-center text-center gap-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-kumo-tint text-kumo-danger">
          <LinkBreakIcon size={36} />
        </div>

        <div>
          <Text as="h1" variant="heading2">
            {t("title")}
          </Text>
          <Text variant="secondary" DANGEROUS_className="mt-1">
            {t("description")}
          </Text>
        </div>

        <Link href="/" className="w-full">
          <Button variant="secondary" size="base" className="w-full">
            {t("backHome")}
          </Button>
        </Link>
      </LayerCard>
    </div>
  );
}
