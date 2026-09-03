import { NextResponse } from "next/server";
import { getInstanceAdminSession } from "@/lib/require-admin";
import { jsonError } from "@/lib/services/http";
import {
  getInstanceSettings,
  socialProvidersStatus,
  updateInstanceSettings,
} from "@/lib/services/instance-settings";

export async function GET() {
  const session = await getInstanceAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await getInstanceSettings();
    return NextResponse.json({ settings, social: socialProvidersStatus() });
  } catch (error) {
    return jsonError(error, "Failed to load instance settings");
  }
}

export async function PATCH(request: Request) {
  const session = await getInstanceAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const settings = await updateInstanceSettings(body ?? {}, session.user.id);
    return NextResponse.json({ settings, social: socialProvidersStatus() });
  } catch (error) {
    return jsonError(error, "Failed to save instance settings");
  }
}
