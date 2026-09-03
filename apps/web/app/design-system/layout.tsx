import { notFound } from "next/navigation";

// The component gallery is a development aid; there is no reason to expose the
// full inventory of screens and states on a deployed instance.
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
