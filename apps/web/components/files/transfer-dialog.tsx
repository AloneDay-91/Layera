"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dialog, Loader, Text, useKumoToastManager } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";
import type { FileItem } from "@/lib/file-item";

type WorkspaceOption = { id: string; name: string; type: string };

export function TransferDialog({
  item,
  onClose,
  onTransferred,
}: {
  item: FileItem | null;
  onClose: () => void;
  onTransferred: () => void;
}) {
  const t = useTranslations("transferDialog");
  const tBrowser = useTranslations("fileBrowser");
  const toasts = useKumoToastManager();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!item) return;
    fetch("/api/workspaces")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setWorkspaces(data?.workspaces ?? []);
        setActiveId(data?.activeWorkspaceId ?? null);
        setTargetId("");
      })
      .catch(() => setWorkspaces([]));
  }, [item]);

  const destinations = workspaces.filter((workspace) => workspace.id !== activeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !targetId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/files/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, type: item.type, targetWorkspaceId: targetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "transfer failed");
      }
      toasts.add({ title: t("successTitle"), description: t("successDescription", { name: item.name }) });
      onTransferred();
      onClose();
    } catch (err) {
      toasts.add({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : t("errorDescription"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{t("title", { name: item?.name ?? "" })}</Dialog.Title>
          <Dialog.Close
            aria-label={tBrowser("close")}
            render={(props) => (
              <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tBrowser("close")} />
            )}
          />
        </div>
        {destinations.length === 0 ? (
          <Text variant="secondary">{t("noDestination")}</Text>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Text variant="secondary">{t("help")}</Text>
            <select
              className="h-8 rounded-lg border border-kumo-line bg-kumo-base px-2 text-sm text-kumo-default"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              <option value="">{t("chooseWorkspace")}</option>
              {destinations.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                {tBrowser("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={!targetId || submitting}>
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("transferring")}
                  </span>
                ) : (
                  t("transfer")
                )}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
