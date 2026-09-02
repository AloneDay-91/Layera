import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/require-admin";
import { getAppVersion } from "@/lib/app-version";
import { fetchLatestRelease, toUpdatesResponse } from "@/lib/updates";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = getAppVersion();
  const release = await fetchLatestRelease();
  return NextResponse.json(toUpdatesResponse(current, release));
}
