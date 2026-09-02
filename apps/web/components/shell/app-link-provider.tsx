"use client";

import { forwardRef, type MouseEvent } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo";
import { useNavigation } from "./navigation-provider";

function hrefToPath(href: LinkComponentProps["href"] | LinkComponentProps["to"]): string {
  if (typeof href === "string") return href;
  return "";
}

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ to, href, onClick, ...rest }, ref) => {
  const { markPending } = useNavigation();
  const target = href ?? to ?? "#";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const unmodified =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;
    if (unmodified) {
      const path = hrefToPath(target);
      if (path) markPending(path);
    }
    onClick?.(event);
  }

  return <NextLink ref={ref} {...rest} prefetch={false} href={target} onClick={handleClick} />;
});
AppLink.displayName = "AppLink";

export function AppLinkProvider({ children }: { children: React.ReactNode }) {
  return <LinkProvider component={AppLink}>{children}</LinkProvider>;
}
