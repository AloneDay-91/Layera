import { NextResponse } from "next/server";
import { getPublicInstanceSettings } from "@/lib/services/instance-settings";

export async function GET() {
  try {
    const settings = await getPublicInstanceSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[GET /api/instance Error]:", error);
    return NextResponse.json({ instanceName: "Layera", registrationEnabled: true });
  }
}
