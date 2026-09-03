import { Chapter } from "@/components/marketing/chapter";
import { InstallSnippet } from "@/components/marketing/install-snippet";

const stack = [
  { label: "Postgres", detail: "Folders, members, shares, and audit live here." },
  { label: "MinIO / S3", detail: "Private objects only. The app mints temporary URLs." },
  { label: "Compose", detail: "Web, worker, and migrations in one file on your VPS." },
] as const;

export function MarketingSelfHost() {
  return (
    <Chapter
      id="self-host"
      eyebrow="Deploy"
      title="One Compose file. Your machine. Done."
      description="Layera is an install, not a tenant. You keep the database, the bucket, and the domain. Expose only the web app."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-5">
          {stack.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <p className="text-sm text-foreground">{item.label}</p>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
        <div className="self-start">
          <InstallSnippet />
        </div>
      </div>
    </Chapter>
  );
}
