import Link from "next/link";
import { productFeatures, stackItems } from "@/lib/features";
import { GITHUB_URL, SITE_NAME } from "@/lib/site";
import { upcomingPages } from "@/lib/upcoming";

const linkClassName =
  "text-sm text-foreground/80 transition-colors hover:text-foreground";

export function MarketingFooter() {
  return (
    <footer className="relative flex w-full flex-col border-t border-border">
      <div className="grid gap-10 py-16 sm:grid-cols-2 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-foreground transition-colors hover:text-muted-foreground"
          >
            Open GitHub
          </a>
          <p className="text-sm text-muted-foreground">© {SITE_NAME} 2026</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Product</p>
          {productFeatures.map((feature) => (
            <Link key={feature.id} href={feature.href} className={linkClassName}>
              {feature.title}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Deploy</p>
          {stackItems.map((item) => (
            <Link key={item.title} href={item.href} className={linkClassName}>
              {item.title}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Source</p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={linkClassName}
          >
            GitHub
          </a>
          <Link href="/#self-host" className={linkClassName}>
            Self-host
          </Link>
          <Link href="/soon" className={linkClassName}>
            Coming later
          </Link>
          {upcomingPages.map((page) => (
            <Link key={page.slug} href={`/${page.slug}`} className={linkClassName}>
              {page.title}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
