import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import {
  listFolderContents,
  createFolder,
  updateFolder,
  updateFile,
  trashItemInWorkspace,
  permanentlyDeleteItem,
} from "@/lib/services/files";
import { ServiceError } from "@/lib/services/errors";

export async function GET(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const parentIdParam = searchParams.get("parentId");
    const searchParam = searchParams.get("search") || searchParams.get("q");

    const result = await listFolderContents(ctx, {
      parentId: parentIdParam,
      search: searchParam,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "Failed to fetch files");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const body = await request.json();
    const { name, parentId, type } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (type !== "folder") {
      throw new ServiceError(400, "Files must be uploaded via the upload API");
    }

    const item = await createFolder(ctx, { name, parentId });
    return NextResponse.json({ item });
  } catch (error) {
    return jsonError(error, "Failed to create item");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { id, type, name, targetFolderId, color } = await request.json();

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    const item =
      type === "folder"
        ? await updateFolder(ctx, { id, name, targetFolderId, color })
        : await updateFile(ctx, { id, name, targetFolderId });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    return jsonError(error, "Failed to update item");
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getAuthorizedWorkspace();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    const permanent = searchParams.get("permanent") === "true";

    if (!id || (type !== "file" && type !== "folder")) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
    }

    if (permanent) {
      await permanentlyDeleteItem(ctx, { id, type });
    } else {
      await trashItemInWorkspace(ctx, { id, type });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error, "Failed to delete item");
  }
}
