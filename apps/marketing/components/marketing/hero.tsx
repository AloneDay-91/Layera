import { HeroFeatures } from "@/components/marketing/hero-features";
import { MediaFrame } from "@/components/marketing/media-frame";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";

export function MarketingHero() {
  return (
    <section className="flex w-full flex-col gap-12 pt-4 pb-12 md:gap-16 md:pt-20 md:pb-24">
      <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="flex flex-col items-start justify-center gap-6">
          <h1 className="text-4xl font-medium tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
            Your files stay on your server
          </h1>
          <p className="max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            Layera is a file manager you install yourself. Folders and rights live in Postgres.
            Bytes live in MinIO. Nobody else hosts the bucket.
          </p>
          <Button asChild size="lg" className="h-10 rounded-full px-5 text-sm">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Open GitHub
            </a>
          </Button>
        </div>
        <MediaFrame
          fill
          src="/product/dashboard.png"
          alt="Layera dashboard — workspace, file table, search, and storage meter"
          sizes="(min-width: 1024px) 736px, (min-width: 768px) 60vw, 100vw"
          className="h-full min-h-80 w-full"
          priority
        />
      </div>
      <HeroFeatures />
    </section>
  );
}
