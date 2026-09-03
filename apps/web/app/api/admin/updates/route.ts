import { NextResponse } from "next/server";
import { getInstanceAdminSession } from "@/lib/require-admin";
import { getAppVersion } from "@/lib/app-version";
import { fetchLatestRelease, toUpdatesResponse } from "@/lib/updates";

export async function GET(request: Request) {
  const session = await getInstanceAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = getAppVersion();
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const release = await fetchLatestRelease({ refresh });
  return NextResponse.json(toUpdatesResponse(current, release));
}
