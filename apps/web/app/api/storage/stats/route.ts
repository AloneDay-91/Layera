import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { workspaceStorageStats } from "@/lib/services/quota";
import { getQuotaLimits } from "@/lib/services/instance-settings";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const [stats, { quotaBytes }] = await Promise.all([
      workspaceStorageStats(ctx.workspace.id),
      getQuotaLimits(),
    ]);

    return NextResponse.json({
      ...stats,
      quotaBytes,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch storage stats");
  }
}
