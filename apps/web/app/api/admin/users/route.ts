import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/require-admin";
import { jsonError } from "@/lib/services/http";
import { listAdminUsers } from "@/lib/services/admin";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") ?? undefined;
    const users = await listAdminUsers(search);
    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error, "Failed to fetch users");
  }
}
