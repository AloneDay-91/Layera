import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/require-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }
  return <>{children}</>;
}
