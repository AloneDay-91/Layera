import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import type { DashboardUser } from "@/components/shell/dashboard-user";
import { auth } from "@/lib/auth";
import { getInstanceSettings } from "@/lib/services/instance-settings";

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
  const [session, settings] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getInstanceSettings(),
  ]);

  // The middleware only sees whether a session cookie exists, which anyone can
  // fabricate to render the shell. This is the check that actually validates it.
  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell
      initialUser={toDashboardUser(session?.user)}
      initialFeatures={{
        publicSharingEnabled: settings.publicSharingEnabled,
        teamsEnabled: settings.teamsEnabled,
        favoritesEnabled: settings.favoritesEnabled,
        tagsEnabled: settings.tagsEnabled,
        archiveEnabled: settings.archiveEnabled,
      }}
    >
      {children}
    </DashboardShell>
  );
}
