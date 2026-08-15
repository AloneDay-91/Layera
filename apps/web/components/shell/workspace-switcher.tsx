"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dialog, DropdownMenu, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { FoldersIcon, UsersThreeIcon, PlusIcon, CheckIcon, CaretUpDownIcon, XIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { AppLogo } from "./app-logo";

type WorkspaceOption = {
  id: string;
  name: string;
  type: "personal" | "team";
  organizationId: string | null;
  role: string;
};

export function WorkspaceSwitcher() {
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const t = useTranslations("workspaceSwitcher");
  const tToasts = useTranslations("workspaceSwitcher.toasts");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  async function loadWorkspaces() {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return;
    const data = await res.json();
    setWorkspaces(data.workspaces ?? []);
    setActiveWorkspaceId(data.activeWorkspaceId ?? null);
  }

  useEffect(() => {
    loadWorkspaces();
  }, [session?.user.id, activeOrg?.id]);

  const activeWorkspaceName =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ??
    activeOrg?.name ??
    (session?.user?.name ? t("personalWorkspaceOf", { name: session.user.name }) : t("personalWorkspace"));

  async function handleSelectWorkspace(workspace: WorkspaceOption) {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    if (!res.ok) {
      toasts.add({ title: tToasts("switchErrorTitle"), description: tToasts("switchErrorFallback") });
      return;
    }
    await authClient.organization.setActive({ organizationId: workspace.organizationId });
    setActiveWorkspaceId(workspace.id);
    toasts.add({
      title: tToasts("activeWorkspaceChangedTitle"),
      description: tToasts("activeWorkspaceChangedDescription", { name: workspace.name }),
    });
    router.refresh();
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreating(true);
    const slug = newOrgName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: newOrg, error } = await authClient.organization.create({
      name: newOrgName.trim(),
      slug: slug || `org-${Date.now()}`,
    });
    setCreating(false);

    if (error) {
      toasts.add({
        title: tToasts("createErrorTitle"),
        description: error.message ?? tToasts("createErrorFallback"),
      });
      return;
    }

    if (newOrg) {
      await authClient.organization.setActive({ organizationId: newOrg.id });
      const listRes = await fetch("/api/workspaces");
      if (listRes.ok) {
        const data = await listRes.json();
        const created = (data.workspaces ?? []).find(
          (workspace: WorkspaceOption) => workspace.organizationId === newOrg.id,
        );
        if (created) {
          await fetch("/api/workspaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId: created.id }),
          });
          setActiveWorkspaceId(created.id);
        }
        setWorkspaces(data.workspaces ?? []);
      }
      router.refresh();
    }

    toasts.add({
      title: tToasts("workspaceCreatedTitle"),
      description: tToasts("workspaceCreatedDescription", { name: newOrgName }),
    });
    setNewOrgName("");
    setIsModalOpen(false);
  }

  return (
    <>
      <div className="flex w-full items-center gap-2 min-w-0">
        <AppLogo size={26} className="shrink-0" />
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Button
              variant="ghost"
              className="flex-1 min-w-0 justify-between gap-1 px-2 text-left font-medium"
            >
              <span className="truncate">{activeWorkspaceName}</span>
              <CaretUpDownIcon size={14} className="shrink-0 opacity-60 ml-1" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Group>
              <DropdownMenu.Label>{t("workspacesLabel")}</DropdownMenu.Label>

              {workspaces.map((workspace) => {
                const isSelected = workspace.id === activeWorkspaceId;
                return (
                  <DropdownMenu.Item
                    key={workspace.id}
                    icon={workspace.type === "team" ? UsersThreeIcon : FoldersIcon}
                    onClick={() => handleSelectWorkspace(workspace)}
                  >
                    <span className="flex-1 truncate">{workspace.name}</span>
                    {isSelected && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Group>

            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={PlusIcon} onClick={() => setIsModalOpen(true)}>
              {t("newWorkspace")}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {/* Modale de création de Workspace */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{t("createDialogTitle")}</Dialog.Title>
            <Dialog.Close
              aria-label={t("close")}
              render={(props) => (
                <Button
                  {...props}
                  variant="secondary"
                  shape="square"
                  size="sm"
                  icon={XIcon}
                  aria-label={t("close")}
                />
              )}
            />
          </div>

          <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
            <Input
              size="sm"
              label={t("workspaceNameLabel")}
              placeholder={t("workspaceNamePlaceholder")}
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
              autoFocus
            />

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={creating}>
                {creating ? (
                  <span className="flex items-center gap-1.5">
                    <Loader size="sm" /> {t("creating")}
                  </span>
                ) : (
                  t("createWorkspace")
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </>
  );
}
