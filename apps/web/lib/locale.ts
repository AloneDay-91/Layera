export const SUPPORTED_LOCALES = ["en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "filecloud-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const short = value.trim().slice(0, 2).toLowerCase();
  return isLocale(short) ? short : null;
}

export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const parsed = parseLocale(part.split(";")[0]);
    if (parsed) return parsed;
  }
  return null;
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  return parseLocale(cookieValue) ?? localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
