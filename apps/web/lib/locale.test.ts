import { describe, expect, it } from "vitest";
import {
  localeFromAcceptLanguage,
  parseLocale,
  resolveLocale,
} from "./locale";

describe("locale helpers", () => {
  it("parses exact and regional tags", () => {
    expect(parseLocale("fr")).toBe("fr");
    expect(parseLocale("fr-FR")).toBe("fr");
    expect(parseLocale("en-US")).toBe("en");
    expect(parseLocale("de")).toBe(null);
    expect(parseLocale(undefined)).toBe(null);
  });

  it("picks the first supported Accept-Language tag", () => {
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(localeFromAcceptLanguage("de,en-US;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE")).toBe(null);
  });

  it("prefers the cookie over Accept-Language", () => {
    expect(resolveLocale("en", "fr-FR")).toBe("en");
    expect(resolveLocale(undefined, "fr-FR,en;q=0.8")).toBe("fr");
    expect(resolveLocale(undefined, "de")).toBe("en");
  });
});
