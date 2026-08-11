"use client";

import { forwardRef } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ to, href, ...rest }, ref) => (
  <NextLink ref={ref} {...rest} href={href ?? to ?? "#"} />
));
AppLink.displayName = "AppLink";

export function AppLinkProvider({ children }: { children: React.ReactNode }) {
  return <LinkProvider component={AppLink}>{children}</LinkProvider>;
}
