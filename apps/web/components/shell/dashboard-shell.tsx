"use client";

import { Suspense } from "react";
import { Sidebar } from "@cloudflare/kumo";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DashboardCodeProvider } from "./dashboard-code-provider";
import { DashboardPageSkeleton } from "./dashboard-page-skeleton";
import { useNavigation } from "./navigation-provider";
import type { DashboardUser } from "./dashboard-user";

export function DashboardShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: DashboardUser | null;
}) {
  const { isPending } = useNavigation();

  return (
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
        <DashboardSidebar initialUser={initialUser} />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-kumo-base text-kumo-default">
          <Suspense fallback={<div className="h-14.5 border-b border-kumo-line" />}>
            <DashboardHeader initialUser={initialUser} />
          </Suspense>
          <main
            className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-kumo-base p-6 text-kumo-default"
            aria-busy={isPending}
          >
            <div className={isPending ? "hidden" : "flex min-h-0 min-w-0 flex-1 flex-col"} aria-hidden={isPending}>
              {children}
            </div>
            {isPending ? <DashboardPageSkeleton /> : null}
          </main>
        </div>
      </Sidebar.Provider>
    </DashboardCodeProvider>
  );
}
