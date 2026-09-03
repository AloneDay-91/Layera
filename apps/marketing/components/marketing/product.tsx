import { Chapter } from "@/components/marketing/chapter";
import { MediaFrame } from "@/components/marketing/media-frame";

export function MarketingProduct() {
  return (
    <Chapter
      id="product"
      eyebrow="The dashboard"
      title="Browse, search, and share without leaving your install"
      description="List or grid, a details pane, and search by name. What you see here is the real app after signup — not a mock."
    >
      <MediaFrame
        src="/product/dashboard.png"
        alt="Layera dashboard — workspace, file table, search, and storage meter"
        width={1440}
        height={900}
        sizes="(min-width: 1920px) 1800px, 100vw"
      />
    </Chapter>
  );
}
