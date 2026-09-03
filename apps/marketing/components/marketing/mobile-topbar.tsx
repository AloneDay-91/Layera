"use client";

import { ListIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { SiteLogo } from "@/components/marketing/site-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GITHUB_URL, SITE_NAME } from "@/lib/site";

const mobileLinks = [
  { title: "Overview", href: "/" },
  { title: "Dashboard", href: "/#product" },
  { title: "How it works", href: "/#features" },
  { title: "Deploy", href: "/#self-host" },
  { title: "Coming later", href: "/soon" },
  { title: "GitHub", href: GITHUB_URL, target: "_blank" as const },
];

export function MarketingMobileTopbar() {
  return (
    <div className="flex w-full items-center justify-between py-6 md:hidden">
      <SiteLogo />
      <Sheet>
        <SheetTrigger
          className="inline-flex size-9 items-center justify-center text-muted-foreground"
          aria-label="Open menu"
        >
          <ListIcon className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="border-border bg-background">
          <SheetHeader>
            <SheetTitle className="font-normal">{SITE_NAME}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-6 py-2">
            {mobileLinks.map((item) =>
              item.target === "_blank" ? (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1 text-lg tracking-tight text-foreground"
                >
                  {item.title}
                </a>
              ) : (
                <Link
                  key={item.title}
                  href={item.href}
                  className="py-1 text-lg tracking-tight text-foreground"
                >
                  {item.title}
                </Link>
              ),
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
