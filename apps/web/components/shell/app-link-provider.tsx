"use client";

import { forwardRef, type MouseEvent } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo";
import { normalizeAppPath, useNavigation } from "./navigation-provider";

function hrefToPath(href: LinkComponentProps["href"] | LinkComponentProps["to"]): string {
  return typeof href === "string" ? href : "";
}

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ to, href, onClick, ...rest }, ref) => {
  const { markPending } = useNavigation();
  const target = href ?? to ?? "#";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const unmodified = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!unmodified) return;

    const path = hrefToPath(target);
    if (!path || path.startsWith("http") || path.startsWith("mailto:")) return;
    if (!normalizeAppPath(path).startsWith("/dashboard")) return;

    event.preventDefault();
    markPending(path);
  }

  return <NextLink ref={ref} {...rest} prefetch={false} href={target} onClick={handleClick} />;
});
AppLink.displayName = "AppLink";

export function AppLinkProvider({ children }: { children: React.ReactNode }) {
  return <LinkProvider component={AppLink}>{children}</LinkProvider>;
}
