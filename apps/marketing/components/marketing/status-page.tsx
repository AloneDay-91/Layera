import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type StatusAction = {
  href: string;
  label: string;
  external?: boolean;
  variant?: "default" | "outline" | "secondary";
};

type StatusPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions: StatusAction[];
  children?: ReactNode;
};

export function StatusPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: StatusPageProps) {
  return (
    <section className="flex w-full flex-col gap-10 pt-6 pb-16 md:pt-12 md:pb-24">
      <div className="flex max-w-xl flex-col items-start gap-4">
        <p className="text-sm tracking-wide text-muted-foreground">{eyebrow}</p>
        <h1 className="text-4xl font-medium tracking-tight text-balance text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {actions.map((action) => (
            <Button
              key={action.href + action.label}
              asChild
              variant={action.variant ?? "default"}
              size="lg"
              className="h-10 rounded-full px-5 text-sm"
            >
              {action.external ? (
                <a href={action.href} target="_blank" rel="noreferrer">
                  {action.label}
                </a>
              ) : (
                <Link href={action.href}>{action.label}</Link>
              )}
            </Button>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
