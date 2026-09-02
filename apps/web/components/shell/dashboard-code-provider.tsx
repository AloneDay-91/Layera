"use client";

import { ShikiProvider } from "@cloudflare/kumo/code";
import { SHIKI_LANGUAGES } from "@/lib/code-lang";

export function DashboardCodeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ShikiProvider engine="javascript" languages={[...SHIKI_LANGUAGES]}>
      {children}
    </ShikiProvider>
  );
}
