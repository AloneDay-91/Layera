"use client";

import { Sidebar, Toasty, TooltipProvider } from "@cloudflare/kumo";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Toasty>
      <TooltipProvider>
        <Sidebar.Provider>
          <DashboardSidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <DashboardHeader />
            <main className="flex min-w-0 flex-1 flex-col overflow-auto p-6">{children}</main>
          </div>
        </Sidebar.Provider>
      </TooltipProvider>
    </Toasty>
  );
}
