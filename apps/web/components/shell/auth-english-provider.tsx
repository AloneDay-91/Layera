"use client";

import { useEffect, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

export function AuthEnglishProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = "en";
    return () => {
      document.documentElement.lang = previous;
    };
  }, []);

  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
