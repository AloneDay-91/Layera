export type WorkspaceRole = "owner" | "member";

export type WorkspaceType = "personal" | "team";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = ["owner", "member"];

export const WORKSPACE_TYPES: readonly WorkspaceType[] = ["personal", "team"];

export type FileItemType = "file" | "folder";

export type ItemTag = {
  id: string;
  name: string;
  color: string;
};

export type FileItem = {
  id: string;
  parentId: string | null;
  type: FileItemType;
  name: string;
  mimeType: string | null;
  size: number | null;
  updatedAt: string;
  owner: string;
  ownerId?: string | null;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags?: ItemTag[];
  color?: string | null;
  sharedBy?: { id: string; name: string } | null;
  hasThumbnail?: boolean;
  thumbnailUrl?: string;
};
