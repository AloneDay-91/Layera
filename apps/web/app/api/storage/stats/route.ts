import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { STORAGE_QUOTA_BYTES, workspaceStorageStats } from "@/lib/services/quota";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const stats = await workspaceStorageStats(ctx.workspace.id);

    return NextResponse.json({
      ...stats,
      quotaBytes: STORAGE_QUOTA_BYTES,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch storage stats");
  }
}
