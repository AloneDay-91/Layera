import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/services/trash";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purged = await purgeExpiredTrash();
  return NextResponse.json({ ok: true, purged });
}
