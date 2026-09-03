import { MarketingCta } from "@/components/marketing/cta";
import { MarketingFeatures } from "@/components/marketing/features";
import { MarketingHero } from "@/components/marketing/hero";
import { LandingShell } from "@/components/marketing/landing-shell";
import { MarketingProduct } from "@/components/marketing/product";
import { MarketingSelfHost } from "@/components/marketing/self-host";

export default function HomePage() {
  return (
    <LandingShell>
      <MarketingHero />
      <MarketingProduct />
      <MarketingFeatures />
      <MarketingSelfHost />
      <MarketingCta />
    </LandingShell>
  );
}
