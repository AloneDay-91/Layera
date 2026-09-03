"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, LayerCard, Table, Text } from "@cloudflare/kumo";
import {
  FileTextIcon,
  FolderIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  LinkSimpleIcon,
  NotebookIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { AppLogo } from "@/components/shell/app-logo";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const t = useTranslations("authShell");

  const previewRows = [
    { name: t("file1Name"), type: t("file1Type"), size: t("file1Size"), icon: FileTextIcon },
    { name: t("file2Name"), type: t("file2Type"), size: t("file2Size"), icon: FolderIcon },
    { name: t("file3Name"), type: t("file3Type"), size: t("file3Size"), icon: NotebookIcon },
  ];

  const features = [
    { title: t("filesTitle"), body: t("filesBody"), icon: FolderIcon },
    { title: t("shareTitle"), body: t("shareBody"), icon: LinkSimpleIcon },
    { title: t("teamTitle"), body: t("teamBody"), icon: UsersThreeIcon },
  ];

  return (
    <main className="h-full lg:grid lg:grid-cols-2">
      <aside className="hidden h-full overflow-y-auto border-r border-kumo-line bg-kumo-tint px-10 lg:flex">
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 py-8">
          <div className="flex items-start gap-2">
            <span className="h-lh flex items-center">
              <AppLogo size={20} />
            </span>
            <Text>Layera</Text>
            <Badge variant="outline">{t("badge")}</Badge>
          </div>

          <div className="grid gap-1.5">
            <Text as="h2" variant="heading1">
              {t("headline")}
            </Text>
            <Text variant="secondary">{t("body")}</Text>
          </div>

          <LayerCard>
            <LayerCard.Secondary className="flex items-center justify-between gap-3">
              <Text>{t("previewTitle")}</Text>
              <Badge variant="secondary">{t("previewCount")}</Badge>
            </LayerCard.Secondary>
            <LayerCard.Primary>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>{t("colName")}</Table.Head>
                    <Table.Head>{t("colType")}</Table.Head>
                    <Table.Head>{t("colSize")}</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {previewRows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <Table.Row key={row.name}>
                        <Table.Cell>
                          <div className="flex items-start gap-2">
                            <span className="h-lh flex items-center">
                              <Icon size={14} />
                            </span>
                            <Text>{row.name}</Text>
                          </div>
                        </Table.Cell>
                        <Table.Cell>{row.type}</Table.Cell>
                        <Table.Cell>{row.size}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            </LayerCard.Primary>
          </LayerCard>

          <div className="grid grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="grid gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="h-lh flex items-center">
                      <Icon size={16} />
                    </span>
                    <Text bold>{feature.title}</Text>
                  </div>
                  <Text variant="secondary">{feature.body}</Text>
                </div>
              );
            })}
          </div>

          <Text variant="secondary">{t("footnote")}</Text>
        </div>
      </aside>

      <section className="flex h-full flex-col overflow-y-auto bg-kumo-base">
        <div className="flex items-start justify-between gap-3 px-5 py-4 lg:hidden">
          <div className="flex items-start gap-2">
            <span className="h-lh flex items-center">
              <AppLogo size={18} />
            </span>
            <Text>Layera</Text>
          </div>
          <Badge variant="outline">{t("badge")}</Badge>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <div className="grid w-full max-w-md gap-4">
            <div className="grid gap-1.5">
              <Text as="h1" variant="heading2">
                {title}
              </Text>
              <Text variant="secondary">{description}</Text>
            </div>
            <LayerCard className="px-5 py-4">
              <div className="grid gap-6">{children}</div>
            </LayerCard>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthSocialButtons({
  githubLabel,
  googleLabel,
  onGithub,
  onGoogle,
}: {
  githubLabel: string;
  googleLabel: string;
  onGithub: () => void;
  onGoogle: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={GithubLogoIcon}
        onClick={onGithub}
        aria-label={githubLabel}
        className="w-full justify-center"
      >
        GitHub
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={GoogleLogoIcon}
        onClick={onGoogle}
        aria-label={googleLabel}
        className="w-full justify-center"
      >
        Google
      </Button>
    </div>
  );
}
