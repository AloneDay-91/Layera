import { headers } from "next/headers";
import { auth } from "./auth";

export async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}
