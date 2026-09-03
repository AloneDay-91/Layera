import type { ReactNode } from "react";

type ChapterProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function Chapter({ id, eyebrow, title, description, children }: ChapterProps) {
  return (
    <section
      id={id}
      className="flex w-full scroll-mt-28 flex-col gap-10 border-t border-border py-16 md:gap-14 md:py-24"
    >
      <div className="flex max-w-3xl flex-col items-start gap-4">
        {eyebrow ? (
          <p className="text-sm tracking-wide text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h2 className="text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
