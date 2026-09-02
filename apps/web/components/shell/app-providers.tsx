"use client";

import { Toasty, TooltipProvider } from "@cloudflare/kumo";
import type { Locale } from "@/lib/locale";
import { AppLinkProvider } from "./app-link-provider";
import { LocaleProvider } from "./locale-provider";
import { NavigationProvider } from "./navigation-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  return (
    <LocaleProvider initialLocale={locale}>
      <ThemeProvider>
        <Toasty>
          <TooltipProvider>
            <NavigationProvider>
              <AppLinkProvider>{children}</AppLinkProvider>
            </NavigationProvider>
          </TooltipProvider>
        </Toasty>
      </ThemeProvider>
    </LocaleProvider>
  );
}
