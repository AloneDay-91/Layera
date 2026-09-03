import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingShell } from "@/components/marketing/landing-shell";
import { StatusPage } from "@/components/marketing/status-page";
import { getUpcoming, upcomingPages } from "@/lib/upcoming";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return upcomingPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getUpcoming(slug);

  if (!page) {
    return { title: "Not found — Layera" };
  }

  return {
    title: `${page.title} — coming later — Layera`,
    description: page.body,
  };
}

export default async function UpcomingSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getUpcoming(slug);

  if (!page) {
    notFound();
  }

  return (
    <LandingShell>
      <StatusPage
        eyebrow="Coming later"
        title={page.title}
        description={`${page.body} This page is a placeholder until the real one ships.`}
        actions={[
          { href: "/soon", label: "All upcoming", variant: "secondary" },
          { href: "/", label: "Back to Layera" },
        ]}
      />
    </LandingShell>
  );
}
