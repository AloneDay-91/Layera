import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";

export function MarketingCta() {
  return (
    <section className="flex w-full flex-col items-start gap-6 border-t border-border py-16 md:py-24">
      <div className="flex max-w-xl flex-col items-start gap-3">
        <h2 className="text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          Run it this evening
        </h2>
        <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          Clone the repository, copy the env file, start Compose. The dashboard is yours.
        </p>
      </div>
      <Button asChild size="lg" className="h-10 rounded-full px-5 text-sm">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          Open GitHub
        </a>
      </Button>
    </section>
  );
}
