import Link from "next/link";
import { productFeatures } from "@/lib/features";

export function HeroFeatures() {
  return (
    <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
      {productFeatures.slice(0, 4).map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="flex flex-col gap-2 py-1">
            <span className="text-sm text-foreground">{item.title}</span>
            <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{item.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
