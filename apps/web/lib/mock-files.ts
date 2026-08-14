export type MockItemType = "file" | "folder";

export type ItemTag = {
  id: string;
  name: string;
  color: string;
};

export type MockItem = {
  id: string;
  parentId: string | null;
  type: MockItemType;
  name: string;
  mimeType: string | null;
  size: number | null;
  updatedAt: string;
  owner: string;
  isFavorite?: boolean;
  tags?: ItemTag[];
};

export const MOCK_ITEMS: MockItem[] = [
  {
    id: "documents",
    parentId: null,
    type: "folder",
    name: "Documents",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-01T10:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "photos",
    parentId: null,
    type: "folder",
    name: "Photos",
    mimeType: null,
    size: null,
    updatedAt: "2026-07-28T14:30:00.000Z",
    owner: "Dev User",
  },
  {
    id: "projects",
    parentId: null,
    type: "folder",
    name: "Projects",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-05T09:15:00.000Z",
    owner: "Dev User",
  },
  {
    id: "welcome",
    parentId: null,
    type: "file",
    name: "welcome.pdf",
    mimeType: "application/pdf",
    size: 245_000,
    updatedAt: "2026-07-20T08:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "notes",
    parentId: null,
    type: "file",
    name: "notes.md",
    mimeType: "text/markdown",
    size: 3_200,
    updatedAt: "2026-08-09T16:45:00.000Z",
    owner: "Dev User",
  },
  {
    id: "contracts",
    parentId: "documents",
    type: "folder",
    name: "Contracts",
    mimeType: null,
    size: null,
    updatedAt: "2026-07-15T11:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "invoice-2026",
    parentId: "documents",
    type: "file",
    name: "invoice-2026.pdf",
    mimeType: "application/pdf",
    size: 128_500,
    updatedAt: "2026-08-02T13:20:00.000Z",
    owner: "Dev User",
  },
  {
    id: "budget",
    parentId: "documents",
    type: "file",
    name: "budget.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 54_000,
    updatedAt: "2026-07-30T09:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "contract-acme",
    parentId: "contracts",
    type: "file",
    name: "contract-acme.pdf",
    mimeType: "application/pdf",
    size: 98_000,
    updatedAt: "2026-07-16T10:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "sunset",
    parentId: "photos",
    type: "file",
    name: "sunset.jpg",
    mimeType: "image/jpeg",
    size: 3_400_000,
    updatedAt: "2026-07-28T14:31:00.000Z",
    owner: "Dev User",
  },
  {
    id: "team-offsite",
    parentId: "photos",
    type: "file",
    name: "team-offsite.png",
    mimeType: "image/png",
    size: 5_100_000,
    updatedAt: "2026-07-25T18:00:00.000Z",
    owner: "Dev User",
  },
  {
    id: "filecloud-project",
    parentId: "projects",
    type: "folder",
    name: "FileCloud",
    mimeType: null,
    size: null,
    updatedAt: "2026-08-05T09:16:00.000Z",
    owner: "Dev User",
  },
  {
    id: "roadmap",
    parentId: "projects",
    type: "file",
    name: "roadmap.md",
    mimeType: "text/markdown",
    size: 8_900,
    updatedAt: "2026-08-05T09:20:00.000Z",
    owner: "Dev User",
  },
];

export function getChildren(items: MockItem[], parentId: string | null): MockItem[] {
  return items.filter((item) => item.parentId === parentId);
}

export function getItemById(items: MockItem[], id: string): MockItem | undefined {
  return items.find((item) => item.id === id);
}

export function getBreadcrumbPath(items: MockItem[], folderId: string | null): MockItem[] {
  const path: MockItem[] = [];
  let currentId = folderId;
  while (currentId !== null) {
    const item = getItemById(items, currentId);
    if (!item) break;
    path.unshift(item);
    currentId = item.parentId;
  }
  return path;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  const units = ["B", "Kb", "Mb", "Gb"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
