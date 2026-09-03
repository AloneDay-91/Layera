export const productFeatures = [
  {
    id: "upload",
    href: "/#upload",
    title: "Uploads",
    body: "The browser writes to MinIO with a signed PUT. Large files never go through Next.js.",
  },
  {
    id: "workspaces",
    href: "/#workspaces",
    title: "Workspaces",
    body: "A personal space at signup. Teams later. Membership is checked before any URL is signed.",
  },
  {
    id: "previews",
    href: "/#previews",
    title: "Previews",
    body: "Images, PDFs, Markdown, and code open in place. The object key never leaves the server.",
  },
  {
    id: "shares",
    href: "/#shares",
    title: "Sharing",
    body: "A tokenized link, optional expiry and password. Delete the row and the path is gone.",
  },
  {
    id: "quotas",
    href: "/#self-host",
    title: "Quotas",
    body: "Workspace ceilings are enforced when an upload is signed. Storage stays on your disk.",
  },
  {
    id: "trash",
    href: "/#self-host",
    title: "Trash",
    body: "Soft delete, restore, then purge. A misclick does not wipe the object.",
  },
] as const;

export const stackItems = [
  {
    href: "/#self-host",
    title: "Postgres",
    body: "Folders, members, shares, and audit live in the database.",
  },
  {
    href: "/#self-host",
    title: "MinIO / S3",
    body: "Private objects only. The app mints short-lived URLs.",
  },
  {
    href: "/#self-host",
    title: "Compose",
    body: "Web, worker, and migrations in one file on your VPS.",
  },
] as const;
