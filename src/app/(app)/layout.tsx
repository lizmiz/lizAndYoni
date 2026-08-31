import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return <AppShell user={session?.user}>{children}</AppShell>;
}
