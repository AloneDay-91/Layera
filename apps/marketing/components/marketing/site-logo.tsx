import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <Image src="/logo.svg" alt="" width={32} height={32} priority />
      <span className="text-xl tracking-tight text-foreground">{SITE_NAME}</span>
    </Link>
  );
}
