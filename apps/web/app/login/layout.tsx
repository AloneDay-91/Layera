import { redirectIfAuthenticated } from "@/lib/auth-redirect";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  await redirectIfAuthenticated();
  return children;
}
