import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/shell/app-providers";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-mode="light" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-kumo-base text-kumo-default h-full`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
