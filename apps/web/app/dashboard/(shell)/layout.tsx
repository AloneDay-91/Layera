import { DashboardShell } from "@/components/shell/dashboard-shell";

export default function DashboardShellLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
