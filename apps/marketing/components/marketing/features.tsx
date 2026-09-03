import { Chapter } from "@/components/marketing/chapter";

const steps = [
  {
    id: "upload",
    title: "Files never transit the app",
    body: "A signed PUT goes to MinIO. Progress stays in the browser. Next.js never holds the bytes.",
  },
  {
    id: "workspaces",
    title: "Rights are checked first",
    body: "Each person gets a workspace at signup. Team orgs come later. No signed URL without membership.",
  },
  {
    id: "previews",
    title: "Look at the file, not the key",
    body: "Images, PDFs, Markdown, and code open in the UI. Read URLs expire in minutes.",
  },
  {
    id: "shares",
    title: "A link is a database row",
    body: "Token, optional expiry, optional password. Remove the row and the public path 404s.",
  },
] as const;

export function MarketingFeatures() {
  return (
    <Chapter
      id="features"
      eyebrow="How it works"
      title="The app signs access. The bucket stays closed."
      description="Postgres stores the tree and who can see it. MinIO stores objects. Layera only mints short-lived URLs."
    >
      <ol className="flex flex-col">
        {steps.map((step) => (
          <li
            key={step.id}
            id={step.id}
            className="grid scroll-mt-28 gap-2 border-t border-border py-7 md:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] md:gap-12"
          >
            <h3 className="text-base font-normal text-foreground">{step.title}</h3>
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Chapter>
  );
}
