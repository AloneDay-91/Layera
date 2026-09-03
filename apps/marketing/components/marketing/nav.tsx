"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { SiteLogo } from "@/components/marketing/site-logo";
import { Button } from "@/components/ui/button";
import { type NavMenu, type NavMenuLink, navMenus } from "@/lib/nav-menus";
import { GITHUB_URL, LANDING_MAX_WIDTH } from "@/lib/site";
import { cn } from "@/lib/utils";

export function MarketingNav() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openMenu = navMenus.find((menu) => menu.id === openMenuId) ?? null;

  const closeMenu = () => setOpenMenuId(null);

  return (
    <header className="hidden bg-background md:block">
      <nav
        className="relative flex flex-col"
        onMouseLeave={closeMenu}
        onBlur={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            closeMenu();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeMenu();
          }
        }}
      >
        <div
          className={cn(
            "mx-auto flex w-full items-center justify-between px-6 py-6 md:px-12",
            LANDING_MAX_WIDTH,
          )}
        >
          <div className="flex items-center gap-16">
            <SiteLogo />

            <ul className="flex items-center gap-8">
              {navMenus.map((menu) => (
                <li key={menu.id}>
                  <NavMenuTrigger
                    title={menu.title}
                    isOpen={openMenuId === menu.id}
                    onOpen={() => setOpenMenuId(menu.id)}
                  />
                </li>
              ))}
              <li onMouseEnter={closeMenu}>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <Button asChild className="rounded-full">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Open GitHub
            </a>
          </Button>
        </div>

        {openMenu ? (
          <NavMenuPanel menu={openMenu} onNavigate={closeMenu} />
        ) : null}
      </nav>
    </header>
  );
}

function NavMenuTrigger({
  title,
  isOpen,
  onOpen,
}: {
  title: string;
  isOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onMouseEnter={onOpen}
      onFocus={onOpen}
      className={cn(
        "cursor-pointer text-sm transition-colors",
        isOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {title}
    </button>
  );
}

function NavMenuPanel({
  menu,
  onNavigate,
}: {
  menu: NavMenu;
  onNavigate: () => void;
}) {
  return (
    <div className="absolute top-full right-0 left-0 border-b border-border bg-background">
      <div
        className={cn(
          "mx-auto grid w-full animate-in fade-in slide-in-from-top-1 duration-150 grid-cols-2 gap-8 px-6 pt-8 pb-12 md:px-12",
          LANDING_MAX_WIDTH,
        )}
      >
        <div className="flex flex-col items-start gap-6">
          <p className="text-sm text-muted-foreground">{menu.featured.title}</p>
          <div className="flex flex-col items-start gap-4">
            {menu.featured.items.map((item) => (
              <PanelLink
                key={item.href + item.label}
                item={item}
                featured
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-10">
          {menu.sections.map((section) => (
            <div
              key={section.title}
              className="flex flex-col items-start gap-6"
            >
              <p className="text-sm text-muted-foreground">{section.title}</p>
              <ul className="flex flex-col items-start gap-3">
                {section.items.map((item) => (
                  <li key={item.href + item.label}>
                    <PanelLink item={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PanelLink({
  item,
  featured,
  onNavigate,
}: {
  item: NavMenuLink;
  featured?: boolean;
  onNavigate: () => void;
}) {
  const external = item.target === "_blank" || item.href.startsWith("http");
  const className =
    "inline-flex items-center gap-2 text-foreground transition-colors hover:text-muted-foreground";

  const label = (
    <>
      <span className={featured ? "text-lg font-normal" : "text-sm"}>{item.label}</span>
      {featured && external ? <ArrowUpRightIcon className="size-5" weight="regular" /> : null}
    </>
  );

  if (external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" onClick={onNavigate} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={className}>
      {label}
    </Link>
  );
}
