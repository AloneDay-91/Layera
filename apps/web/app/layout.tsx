import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppLinkProvider } from "@/components/shell/app-link-provider";
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
  title: "FileCloud",
  description: "Gestionnaire de fichiers self-hosted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="light" data-theme="fedramp">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-kumo-base text-kumo-default`}
      >
        <AppLinkProvider>{children}</AppLinkProvider>
      </body>
    </html>
  );
}
