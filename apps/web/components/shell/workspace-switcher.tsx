"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dialog, DropdownMenu, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { FoldersIcon, UsersThreeIcon, PlusIcon, CheckIcon, CaretUpDownIcon, XIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { AppLogo } from "./app-logo";

export function WorkspaceSwitcher() {
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: orgs } = authClient.useListOrganizations();
  const t = useTranslations("workspaceSwitcher");
  const tToasts = useTranslations("workspaceSwitcher.toasts");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const personalWorkspaceName = session?.user?.name
    ? t("personalWorkspaceOf", { name: session.user.name })
    : t("personalWorkspace");

  // Nom du workspace affiché actuellement
  const activeWorkspaceName = activeOrg?.name ?? personalWorkspaceName;

  async function handleSelectOrg(orgId: string | null, orgName: string) {
    const { error } = await authClient.organization.setActive({
      organizationId: orgId,
    });
    if (error) {
      toasts.add({
        title: tToasts("switchErrorTitle"),
        description: error.message ?? tToasts("switchErrorFallback"),
      });
      return;
    }
    toasts.add({
      title: tToasts("activeWorkspaceChangedTitle"),
      description: tToasts("activeWorkspaceChangedDescription", { name: orgName }),
    });
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

              {/* Option Espace personnel */}
              <DropdownMenu.Item
                icon={FoldersIcon}
                onClick={() => handleSelectOrg(null, personalWorkspaceName)}
              >
                <span className="flex-1 truncate">{personalWorkspaceName}</span>
                {!activeOrg && <CheckIcon size={14} className="ml-2 text-kumo-info" />}
              </DropdownMenu.Item>

              {/* Liste des Organisations Better Auth */}
              {orgs?.map((org) => {
                const isSelected = activeOrg?.id === org.id;
                return (
                  <DropdownMenu.Item
                    key={org.id}
                    icon={UsersThreeIcon}
                    onClick={() => handleSelectOrg(org.id, org.name)}
                  >
                    <span className="flex-1 truncate">{org.name}</span>
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
