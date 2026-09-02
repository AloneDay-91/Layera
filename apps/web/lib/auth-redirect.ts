import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

function hasSessionCookie(store: Awaited<ReturnType<typeof cookies>>) {
  return store
    .getAll()
    .some((cookie) => cookie.name === "better-auth.session_token" || cookie.name === "__Secure-better-auth.session_token");
}

export async function redirectIfAuthenticated() {
  const cookieStore = await cookies();
  if (!hasSessionCookie(cookieStore)) return;

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/dashboard");
  }
}
