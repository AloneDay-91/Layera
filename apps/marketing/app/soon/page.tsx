import type { Metadata } from "next";
import Link from "next/link";
import { LandingShell } from "@/components/marketing/landing-shell";
import { StatusPage } from "@/components/marketing/status-page";
import { Badge } from "@/components/ui/badge";
import { upcomingPages } from "@/lib/upcoming";

export const metadata: Metadata = {
  title: "Coming later — Layera",
  description: "Pages we have not shipped yet. The links stay so the site can grow.",
};

export default function SoonPage() {
  return (
    <LandingShell>
      <StatusPage
        eyebrow="Coming later"
        title="Not written yet"
        description="These pages will exist. The links are here so we can point to them now without a dead end."
        actions={[{ href: "/", label: "Back to Layera" }]}
      >
        <ul className="flex max-w-xl flex-col">
          {upcomingPages.map((page) => (
            <li key={page.slug} className="border-t border-border py-6">
              <Link href={`/${page.slug}`} className="flex flex-col gap-2">
                <span className="flex items-center gap-2">
                  <span className="text-base text-foreground">{page.title}</span>
                  <Badge variant="secondary">Soon</Badge>
                </span>
                <span className="text-sm leading-relaxed text-pretty text-muted-foreground">
                  {page.body}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </StatusPage>
    </LandingShell>
  );
}
