import { NextResponse } from "next/server";
import { getAppVersion } from "@/lib/app-version";
import { getInstanceAdminSession } from "@/lib/require-admin";
import { jsonError } from "@/lib/services/http";
import { getInstanceSettings, updateInstanceSettings } from "@/lib/services/instance-settings";
import { getSocialProvidersPublic } from "@/lib/services/social-providers";

async function settingsPayload() {
  const [settings, social] = await Promise.all([getInstanceSettings(), getSocialProvidersPublic()]);
  return { settings, social, version: getAppVersion() };
}

export async function GET() {
  const session = await getInstanceAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json(await settingsPayload());
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
    await updateInstanceSettings(body ?? {}, session.user.id);
    return NextResponse.json(await settingsPayload());
  } catch (error) {
    return jsonError(error, "Failed to save instance settings");
  }
}
