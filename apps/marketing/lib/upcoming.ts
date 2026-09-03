export const upcomingPages = [
  {
    slug: "docs",
    title: "Docs",
    body: "Install, environment variables, and how signed URLs work.",
  },
  {
    slug: "changelog",
    title: "Changelog",
    body: "What landed in each release, in plain language.",
  },
  {
    slug: "guides",
    title: "Guides",
    body: "Self-host notes and day-to-day use of the dashboard.",
  },
] as const;

export type UpcomingPage = (typeof upcomingPages)[number];

export function getUpcoming(slug: string): UpcomingPage | undefined {
  return upcomingPages.find((page) => page.slug === slug);
}
