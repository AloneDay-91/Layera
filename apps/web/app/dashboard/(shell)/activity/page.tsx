"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Breadcrumbs, Empty, LayerCard, SkeletonLine, Table } from "@cloudflare/kumo";
import { ActivityIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { ClientOnly } from "@/components/shell/client-only";

type ActivityEvent = {
  id: string;
  action: string;
  targetType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string; email: string };
};

export default function ActivityPage() {
  const t = useTranslations("activityPage");
  const tBreadcrumbs = useTranslations("fileBreadcrumbs");
  const locale = useLocale();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/activity")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEvents(data.events ?? []);
      })
      .catch((err) => console.error("Activity load error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrg?.id]);

  function actionLabel(action: string) {
    return t.has(`actions.${action}`) ? t(`actions.${action}`) : action;
  }

  function targetName(event: ActivityEvent) {
    const name = event.metadata.name;
    return typeof name === "string" ? name : "—";
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        className="-mx-6 -mt-6"
        breadcrumbs={
          <Breadcrumbs>
            <Breadcrumbs.Link href="/dashboard">{tBreadcrumbs("myFiles")}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>{t("title")}</Breadcrumbs.Current>
          </Breadcrumbs>
        }
        title={t("title")}
        description={t("description")}
      />

      <div className="flex flex-1 flex-col gap-6 max-w-5xl pt-6">
        {loading ? (
          <ClientOnly
            fallback={
              <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg animate-pulse min-h-55" />
            }
          >
            <div className="flex flex-col gap-3 p-4 bg-kumo-base border border-kumo-line rounded-lg">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-kumo-line/40">
                  <SkeletonLine minWidth={40} maxWidth={60} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                  <SkeletonLine minWidth={20} maxWidth={20} minDuration={1.5} maxDuration={1.5} minDelay={0} maxDelay={0} className="h-4" />
                </div>
              ))}
            </div>
          </ClientOnly>
        ) : events.length === 0 ? (
          <LayerCard className="flex flex-col items-center justify-center p-12 text-center">
            <Empty
              size="sm"
              icon={<ActivityIcon size={40} />}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          </LayerCard>
        ) : (
          <LayerCard className="p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t("columns.when")}</Table.Head>
                <Table.Head>{t("columns.actor")}</Table.Head>
                <Table.Head>{t("columns.action")}</Table.Head>
                <Table.Head>{t("columns.target")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {events.map((event) => (
                <Table.Row key={event.id}>
                  <Table.Cell>
                    {new Date(event.createdAt).toLocaleString(locale)}
                  </Table.Cell>
                  <Table.Cell>{event.actor.name}</Table.Cell>
                  <Table.Cell>{actionLabel(event.action)}</Table.Cell>
                  <Table.Cell>{targetName(event)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          </LayerCard>
        )}
      </div>
    </div>
  );
}
