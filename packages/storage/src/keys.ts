export function objectStorageKey(workspaceId: string, objectId: string) {
  return `workspaces/${workspaceId}/${objectId}`;
}

export function thumbnailStorageKey(originalKey: string) {
  return `${originalKey}.thumb.webp`;
}

export function isWorkspaceObjectKey(storageKey: string, workspaceId: string) {
  return storageKey.startsWith(`workspaces/${workspaceId}/`) && !storageKey.includes("..");
}
