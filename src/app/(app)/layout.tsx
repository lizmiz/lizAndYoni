import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getReferenceData } from "@/lib/queries/reference";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, referenceData] = await Promise.all([auth(), getReferenceData()]);

  return (
    <AppShell user={session?.user} referenceData={referenceData}>
      {children}
    </AppShell>
  );
}
