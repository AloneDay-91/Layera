"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Breadcrumbs, Empty, LayerCard, Table, Text } from "@cloudflare/kumo";
import { ActivityIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { PageHeader } from "@/components/kumo/page-header";
import { TableCardSkeleton } from "@/components/shell/table-card-skeleton";
import { usePageReady } from "@/components/shell/navigation-provider";

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
  usePageReady(!loading);

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

      <div className="flex flex-1 flex-col gap-6 pt-6">
        {loading ? (
          <TableCardSkeleton
            columns={[t("columns.when"), t("columns.actor"), t("columns.action"), t("columns.target")]}
          />
        ) : events.length === 0 ? (
          <LayerCard className="p-0">
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
                      <Text variant="secondary">{new Date(event.createdAt).toLocaleString(locale)}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="grid gap-0.5">
                        <Text as="span" bold>{event.actor.name}</Text>
                        <Text as="span" variant="secondary">{event.actor.email}</Text>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="neutral">{actionLabel(event.action)}</Badge>
                    </Table.Cell>
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
