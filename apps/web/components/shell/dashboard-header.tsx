"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button, DropdownMenu, Input, Sidebar, useKumoToastManager } from "@cloudflare/kumo";
import { FolderPlusIcon, UploadSimpleIcon, UserCircleIcon, SignOutIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Mes fichiers",
  "/dashboard/shared": "Partagés",
  "/dashboard/favorites": "Favoris",
  "/dashboard/trash": "Corbeille",
  "/dashboard/settings": "Réglages",
};

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const toasts = useKumoToastManager();
  const { data: session } = authClient.useSession();

  function notifyNotImplemented(action: string) {
    toasts.add({
      title: "Bientôt disponible",
      description: `"${action}" n'est pas encore implémenté.`,
    });
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const pageLabel = PAGE_LABELS[pathname] ?? "FileCloud";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Sidebar.Trigger />
        <h1 className="text-base font-medium">{pageLabel}</h1>
      </div>

      <Input
        placeholder="Rechercher…"
        aria-label="Rechercher des fichiers"
        className="min-w-0 flex-1 basis-40 sm:max-w-xs"
      />

      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={FolderPlusIcon} onClick={() => notifyNotImplemented("Nouveau dossier")}>
          Nouveau dossier
        </Button>
        <Button variant="primary" icon={UploadSimpleIcon} onClick={() => notifyNotImplemented("Upload")}>
          Upload
        </Button>

        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Button
              variant="secondary"
              shape="circle"
              icon={UserCircleIcon}
              aria-label="Menu utilisateur"
            />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Group>
              <DropdownMenu.Label>{session?.user?.name ?? "Mon compte"}</DropdownMenu.Label>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={SignOutIcon} onClick={handleSignOut}>
              Se déconnecter
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </header>
  );
}
