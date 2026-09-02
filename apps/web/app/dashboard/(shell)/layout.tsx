import { headers } from "next/headers";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import type { DashboardUser } from "@/components/shell/dashboard-user";
import { auth } from "@/lib/auth";

function toDashboardUser(user: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
} | undefined): DashboardUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? null,
  };
}

export default async function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  return <DashboardShell initialUser={toDashboardUser(session?.user)}>{children}</DashboardShell>;
}
