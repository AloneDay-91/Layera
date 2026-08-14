"use client";

import { Suspense } from "react";
import { Sidebar } from "@cloudflare/kumo";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { ClientOnly } from "./client-only";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const fallbackShell = (
    <div className="flex h-screen w-full overflow-hidden bg-kumo-base text-kumo-default">
      <div className="w-60 shrink-0 border-r border-kumo-line bg-kumo-base hidden md:block" />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-kumo-base text-kumo-default">
        <header
          suppressHydrationWarning
          className="flex h-14.5 shrink-0 items-center justify-between gap-4 border-b border-kumo-line px-4"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="size-8.5 md:hidden" />
            <h1 className="text-lg font-semibold truncate">Layera</h1>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col overflow-auto p-6 bg-kumo-base text-kumo-default">
          {children}
        </main>
      </div>
    </div>
  );

  return (
    <ClientOnly fallback={fallbackShell}>
      <Sidebar.Provider
        defaultOpen
        resizable
        defaultWidth={240}
        minWidth={180}
        maxWidth={400}
        peekable
        className="h-screen w-full overflow-hidden"
      >
        <DashboardSidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-kumo-base text-kumo-default">
          <Suspense fallback={<div className="h-14.5 border-b border-kumo-line" />}>
            <DashboardHeader />
          </Suspense>
          <main className="flex min-w-0 flex-1 flex-col overflow-auto p-6 bg-kumo-base text-kumo-default">
            {children}
          </main>
        </div>
      </Sidebar.Provider>
    </ClientOnly>
  );
}
