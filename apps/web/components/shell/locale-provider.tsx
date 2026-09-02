"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
  parseLocale,
  SUPPORTED_LOCALES,
} from "@/lib/locale";

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale };

const MESSAGES: Record<Locale, typeof en> = { en, fr };

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

function persistLocale(next: Locale) {
  window.localStorage.setItem(LOCALE_COOKIE, next);
  document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};SameSite=Lax`;
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const cookieLocale = parseLocale(
      document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${LOCALE_COOKIE}=`))
        ?.split("=")[1],
    );
    if (cookieLocale) {
      persistLocale(cookieLocale);
      return;
    }
    const saved = window.localStorage.getItem(LOCALE_COOKIE);
    if (isLocale(saved) && saved !== initialLocale) {
      persistLocale(saved);
      router.refresh();
      return;
    }
    persistLocale(initialLocale);
  }, [initialLocale, router]);

  function setLocale(newLocale: Locale) {
    setLocaleState(newLocale);
    persistLocale(newLocale);
    document.documentElement.lang = newLocale;
    router.refresh();
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
