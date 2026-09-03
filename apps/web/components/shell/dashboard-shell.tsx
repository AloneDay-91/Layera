"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "@cloudflare/kumo";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DashboardCodeProvider } from "./dashboard-code-provider";
import { DashboardPageSkeleton } from "./dashboard-page-skeleton";
import { useNavigation } from "./navigation-provider";
import type { DashboardUser } from "./dashboard-user";
import { UpdateBanner } from "./update-banner";
import { UpdateHelpDialog } from "./update-help-dialog";
import { useAvailableUpdate } from "./use-available-update";
import { InstanceFeaturesProvider, type InstanceFeatures } from "./instance-features";
import { canManageInstanceSettings } from "@/lib/auth-permissions";

export function DashboardShell({
  children,
  initialUser,
  initialFeatures,
}: {
  children: React.ReactNode;
  initialUser: DashboardUser | null;
  initialFeatures: InstanceFeatures;
}) {
  const { isPending } = useNavigation();
  const isAdmin = canManageInstanceSettings(initialUser?.role);
  const { update, dismiss } = useAvailableUpdate(isAdmin);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <InstanceFeaturesProvider initial={initialFeatures}>
    <DashboardCodeProvider>
      <Sidebar.Provider
        defaultOpen
        resizable
        defaultWidth={240}
        minWidth={180}
        maxWidth={400}
        peekable
        className="h-screen w-full overflow-hidden"
      >
        <DashboardSidebar
          initialUser={initialUser}
          availableUpdate={update}
          onDismissUpdate={dismiss}
          onUpdateHelp={() => setHelpOpen(true)}
        />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-kumo-base text-kumo-default">
          <Suspense fallback={<div className="h-14.5 border-b border-kumo-line" />}>
            <DashboardHeader initialUser={initialUser} />
          </Suspense>
          {update ? (
            <UpdateBanner update={update} onDismiss={dismiss} onHelp={() => setHelpOpen(true)} />
          ) : null}
          <main
            className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-kumo-base p-6 text-kumo-default"
            aria-busy={isPending}
          >
            {isPending ? (
              <DashboardPageSkeleton />
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
            )}
          </main>
        </div>
        {update ? (
          <UpdateHelpDialog update={update} open={helpOpen} onOpenChange={setHelpOpen} />
        ) : null}
      </Sidebar.Provider>
    </DashboardCodeProvider>
    </InstanceFeaturesProvider>
  );
}
