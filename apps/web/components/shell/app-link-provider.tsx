"use client";

import { forwardRef } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>((props, ref) => (
  <NextLink ref={ref} {...props} href={props.href ?? "#"} />
));
AppLink.displayName = "AppLink";

export function AppLinkProvider({ children }: { children: React.ReactNode }) {
  return <LinkProvider component={AppLink}>{children}</LinkProvider>;
}
