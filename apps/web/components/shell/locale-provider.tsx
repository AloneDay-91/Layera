"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const MESSAGES: Record<Locale, typeof en> = { en, fr };

const STORAGE_KEY = "filecloud-locale";

function isLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) {
      setLocaleState(saved);
    } else {
      const browserLocale = navigator.language.slice(0, 2);
      if (isLocale(browserLocale)) setLocaleState(browserLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useAppLocale must be used within a LocaleProvider");
  }
  return context;
}
