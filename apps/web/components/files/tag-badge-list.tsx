import { Badge } from "@cloudflare/kumo";
import type { BadgeVariant } from "@cloudflare/kumo";
import type { ItemTag } from "@/lib/mock-files";

export function TagBadgeList({ tags, max }: { tags?: ItemTag[]; max?: number }) {
  if (!tags || tags.length === 0) return null;
  const visible = max ? tags.slice(0, max) : tags;
  const overflow = max ? tags.length - max : 0;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <Badge key={t.id} variant={t.color as BadgeVariant}>
          {t.name}
        </Badge>
      ))}
      {overflow > 0 && <Badge variant="neutral">+{overflow}</Badge>}
    </div>
  );
}
