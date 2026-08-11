"use client";

import { Toasty, TooltipProvider } from "@cloudflare/kumo";
import { AppLinkProvider } from "./app-link-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Toasty>
        <TooltipProvider>
          <AppLinkProvider>{children}</AppLinkProvider>
        </TooltipProvider>
      </Toasty>
    </ThemeProvider>
  );
}
