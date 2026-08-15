import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/services/permissions";
import { jsonError } from "@/lib/services/http";
import { listAuditEvents } from "@/lib/services/audit";

export async function GET() {
  try {
    const ctx = await getAuthorizedWorkspace();
    const events = await listAuditEvents(ctx);
    return NextResponse.json({ events });
  } catch (error) {
    return jsonError(error, "Failed to fetch activity");
  }
}
