import { GITHUB_URL } from "@/lib/site";
import { upcomingPages } from "@/lib/upcoming";

export type NavMenuLink = {
  label: string;
  href: string;
  target?: "_blank";
};

export type NavMenuSection = {
  title: string;
  items: NavMenuLink[];
};

export type NavMenu = {
  id: string;
  title: string;
  featured: NavMenuSection;
  sections: NavMenuSection[];
};

export const navMenus: NavMenu[] = [
  {
    id: "product",
    title: "Product",
    featured: {
      title: "In the app",
      items: [
        { label: "Uploads", href: "/#upload" },
        { label: "Workspaces", href: "/#workspaces" },
        { label: "Sharing", href: "/#shares" },
      ],
    },
    sections: [
      {
        title: "Also included",
        items: [
          { label: "Previews", href: "/#previews" },
          { label: "Quotas", href: "/#self-host" },
          { label: "Trash", href: "/#self-host" },
        ],
      },
    ],
  },
  {
    id: "deploy",
    title: "Deploy",
    featured: {
      title: "Run it yourself",
      items: [{ label: "Self-host", href: "/#self-host" }],
    },
    sections: [
      {
        title: "What you install",
        items: [
          { label: "Postgres", href: "/#self-host" },
          { label: "MinIO / S3", href: "/#self-host" },
          { label: "Docker Compose", href: "/#self-host" },
        ],
      },
      {
        title: "Code",
        items: [{ label: "GitHub", href: GITHUB_URL, target: "_blank" }],
      },
    ],
  },
  {
    id: "later",
    title: "Later",
    featured: {
      title: "Coming later",
      items: [{ label: "All upcoming", href: "/soon" }],
    },
    sections: [
      {
        title: "Planned",
        items: upcomingPages.map((page) => ({
          label: page.title,
          href: `/${page.slug}`,
        })),
      },
    ],
  },
];
