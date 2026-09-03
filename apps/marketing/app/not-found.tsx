import { LandingShell } from "@/components/marketing/landing-shell";
import { StatusPage } from "@/components/marketing/status-page";
import { GITHUB_URL } from "@/lib/site";

export default function NotFoundPage() {
  return (
    <LandingShell>
      <StatusPage
        eyebrow="404"
        title="This page is not here"
        description="The URL does not match anything on the site. Go home, or open the repository."
        actions={[
          { href: "/", label: "Back to Layera" },
          { href: GITHUB_URL, label: "Open GitHub", external: true, variant: "outline" },
        ]}
      />
    </LandingShell>
  );
}
