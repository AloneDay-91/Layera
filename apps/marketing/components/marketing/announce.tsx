import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { GITHUB_URL } from "@/lib/site";

export function MarketingAnnounce() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      className="hidden w-full items-center justify-center gap-2 bg-secondary px-5 py-2 text-sm text-foreground transition-colors hover:bg-muted md:flex"
    >
      <span>Clone it, run Compose, keep the files on your VPS</span>
      <ArrowRightIcon className="size-3.5" weight="regular" />
    </a>
  );
}
