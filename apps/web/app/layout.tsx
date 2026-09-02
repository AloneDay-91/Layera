import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/shell/app-providers";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Layera",
  description: "Gestionnaire de fichiers self-hosted.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );

  return (
    <html lang={locale} data-mode="light" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-kumo-base text-kumo-default h-full`}
      >
        <AppProviders locale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
