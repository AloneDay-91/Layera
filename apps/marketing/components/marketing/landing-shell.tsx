import type { ReactNode } from "react";
import { MarketingAnnounce } from "@/components/marketing/announce";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingMobileTopbar } from "@/components/marketing/mobile-topbar";
import { MarketingNav } from "@/components/marketing/nav";
import { LANDING_MAX_WIDTH } from "@/lib/site";
import { cn } from "@/lib/utils";

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="min-h-[100dvh] overflow-x-clip bg-background">
      <div className="sticky top-0 z-50 flex w-full flex-col bg-background">
        <MarketingAnnounce />
        <MarketingNav />
      </div>
      <div className="relative flex flex-col overflow-x-clip md:items-center">
        <div className={cn("flex w-full flex-col px-6 md:px-12", LANDING_MAX_WIDTH)}>
          <MarketingMobileTopbar />
          <main className="relative flex w-full flex-col">{children}</main>
          <MarketingFooter />
        </div>
      </div>
    </div>
  );
}
