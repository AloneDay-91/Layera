import { describe, expect, it } from "vitest";
import { isWorkspaceObjectKey, objectStorageKey, thumbnailStorageKey } from "./keys";

describe("storage keys", () => {
  it("never embeds the display name in the object key", () => {
    const workspaceId = "11111111-1111-4111-8111-111111111111";
    const objectId = "22222222-2222-4222-8222-222222222222";
    const key = objectStorageKey(workspaceId, objectId);

    expect(key).toBe(`workspaces/${workspaceId}/${objectId}`);
    expect(key).not.toContain("secret.txt");
    expect(key).not.toContain("..");
    expect(isWorkspaceObjectKey(key, workspaceId)).toBe(true);
    expect(isWorkspaceObjectKey(key, "other-workspace")).toBe(false);
    expect(isWorkspaceObjectKey(`workspaces/${workspaceId}/../escape`, workspaceId)).toBe(false);
  });

  it("derives thumbnail keys from the object id, not the file name", () => {
    const original = objectStorageKey("ws", "obj");
    expect(thumbnailStorageKey(original)).toBe("workspaces/ws/obj.thumb.webp");
  });
});
