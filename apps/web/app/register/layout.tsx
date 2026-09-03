import { AuthEnglishProvider } from "@/components/shell/auth-english-provider";
import { redirectIfAuthenticated } from "@/lib/auth-redirect";

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  await redirectIfAuthenticated();
  return <AuthEnglishProvider>{children}</AuthEnglishProvider>;
}
