import { NextResponse } from "next/server";
import { getAppVersion } from "@/lib/app-version";
import { DEFAULT_INSTANCE_NAME, getPublicInstanceSettings } from "@/lib/services/instance-settings";

export async function GET() {
  try {
    const settings = await getPublicInstanceSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[GET /api/instance Error]:", error);
    return NextResponse.json({
      instanceName: DEFAULT_INSTANCE_NAME,
      registrationEnabled: false,
      version: getAppVersion(),
      githubEnabled: false,
      googleEnabled: false,
    });
  }
}
