"use client";

import { Toasty, TooltipProvider } from "@cloudflare/kumo";
import { ShikiProvider } from "@cloudflare/kumo/code";
import { SHIKI_LANGUAGES } from "@/lib/code-lang";
import { AppLinkProvider } from "./app-link-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Toasty>
        <TooltipProvider>
          <ShikiProvider engine="javascript" languages={[...SHIKI_LANGUAGES]}>
            <AppLinkProvider>{children}</AppLinkProvider>
          </ShikiProvider>
        </TooltipProvider>
      </Toasty>
    </ThemeProvider>
  );
}
