import { NextResponse } from "next/server";
import { WorkspaceAccessError } from "@filecloud/db";
import { ServiceError } from "./errors";

export function jsonError(error: unknown, fallback: string) {
  if (error instanceof WorkspaceAccessError || error instanceof ServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
