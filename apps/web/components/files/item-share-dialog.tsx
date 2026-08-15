"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dialog, Input, Loader, Tabs, Text, useKumoToastManager } from "@cloudflare/kumo";
import { CopyIcon, TrashIcon, XIcon } from "@phosphor-icons/react";
import type { FileItem } from "@/lib/file-item";
import { UserAvatar } from "./user-avatar";

type Member = { id: string; name: string; email: string; role: string };
type ShareRow = { id: string; userId: string; name: string; email: string };

export function ItemShareDialog({
  item,
  onClose,
}: {
  item: FileItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("itemShareDialog");
  const tBrowser = useTranslations("fileBrowser");
  const toasts = useKumoToastManager();
  const [tab, setTab] = useState("members");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!item) return;
    setTab("members");
    setShareUrl(null);
    setSelectedUserId("");
    fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMembers(data?.members ?? []))
      .catch(() => setMembers([]));
    fetch(`/api/item-shares?itemId=${item.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setShares(data?.shares ?? []))
      .catch(() => setShares([]));
  }, [item]);

  async function ensurePublicLink() {
    if (!item || shareUrl || creatingLink) return;
    setCreatingLink(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemType: item.type }),
      });
      if (!res.ok) throw new Error("share failed");
      const data = await res.json();
      setShareUrl(`${window.location.origin}${data.share.url}`);
    } catch {
      toasts.add({ title: t("errorTitle"), description: t("publicLinkError") });
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleShareWithMember(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !selectedUserId) return;
    setSharing(true);
    try {
      const res = await fetch("/api/item-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, itemType: item.type, userId: selectedUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "share failed");
      }
      const sharesRes = await fetch(`/api/item-shares?itemId=${item.id}`);
      const sharesData = sharesRes.ok ? await sharesRes.json() : { shares: [] };
      setShares(sharesData.shares ?? []);
      setSelectedUserId("");
      toasts.add({ title: t("sharedTitle"), description: t("sharedDescription") });
    } catch (err) {
      toasts.add({
        title: t("errorTitle"),
        description: err instanceof Error ? err.message : t("memberShareError"),
      });
    } finally {
      setSharing(false);
    }
  }

  async function handleRevoke(shareId: string) {
    const res = await fetch(`/api/item-shares?id=${shareId}`, { method: "DELETE" });
    if (res.ok) {
      setShares((prev) => prev.filter((share) => share.id !== shareId));
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toasts.add({ title: tBrowser("toasts.linkCopiedTitle"), description: tBrowser("toasts.linkCopiedDescription") });
  }

  const availableMembers = members.filter(
    (member) => !shares.some((share) => share.userId === member.id),
  );

  return (
    <Dialog.Root open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog className="p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">
            {tBrowser("shareTitle", { name: item?.name ?? "" })}
          </Dialog.Title>
          <Dialog.Close
            aria-label={tBrowser("close")}
            render={(props) => (
              <Button {...props} variant="ghost" shape="square" size="sm" icon={XIcon} aria-label={tBrowser("close")} />
            )}
          />
        </div>

        <Tabs
          variant="segmented"
          size="sm"
          tabs={[
            { value: "members", label: t("membersTab") },
            { value: "link", label: t("linkTab") },
          ]}
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            if (value === "link") void ensurePublicLink();
          }}
        />

        {tab === "members" ? (
          <div className="mt-4 flex flex-col gap-4">
            <Text variant="secondary">{t("membersHelp")}</Text>
            <form onSubmit={handleShareWithMember} className="flex gap-2">
              <select
                className="h-8 flex-1 rounded-lg border border-kumo-line bg-kumo-base px-2 text-sm text-kumo-default"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">{t("chooseMember")}</option>
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" type="submit" disabled={!selectedUserId || sharing}>
                {sharing ? <Loader size="sm" /> : t("share")}
              </Button>
            </form>
            {shares.length === 0 ? (
              <Text variant="secondary">{t("noShares")}</Text>
            ) : (
              <ul className="flex flex-col gap-2">
                {shares.map((share) => (
                  <li key={share.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <UserAvatar userId={share.userId} name={share.name} />
                      <span className="flex flex-col">
                        <Text as="span">{share.name}</Text>
                        <Text as="span" variant="secondary">
                          {share.email}
                        </Text>
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      shape="square"
                      size="sm"
                      icon={TrashIcon}
                      aria-label={t("revoke")}
                      onClick={() => handleRevoke(share.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : creatingLink ? (
          <div className="mt-4 flex items-center gap-2 py-4">
            <Loader size="sm" /> {tBrowser("creatingLink")}
          </div>
        ) : shareUrl ? (
          <div className="mt-4 flex flex-col gap-4">
            <Input size="sm" label={tBrowser("shareLinkLabel")} value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                {tBrowser("close")}
              </Button>
              <Button variant="primary" size="sm" icon={CopyIcon} onClick={handleCopy}>
                {tBrowser("copyLink")}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Dialog.Root>
  );
}
