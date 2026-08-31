"use client";

import { Suspense, type ReactNode } from "react";
import type { Session } from "next-auth";
import { NavSidebar } from "@/components/nav-sidebar";
import { NavBottom } from "@/components/nav-bottom";
import { ScopeTabs } from "@/components/scope-tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickAddProvider, useQuickAdd } from "@/components/quick-add/context";
import { QuickAddDialog } from "@/components/quick-add/dialog";

export function AppShell({
  user,
  children,
}: {
  user: Session["user"] | undefined;
  children: ReactNode;
}) {
  return (
    <QuickAddProvider>
      <div className="flex min-h-screen w-full">
        <NavSidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
              <div className="flex items-center gap-2 sm:hidden">
                <span className="text-xl">🧭</span>
                <span className="font-bold text-ink">מצפן פיננסי</span>
              </div>
              <DesktopQuickAdd />
            </div>
            <Suspense>
              <ScopeTabs />
            </Suspense>
          </header>
          <main className="flex-1 px-4 pb-24 pt-2 sm:px-6 sm:pb-10">{children}</main>
        </div>
        <MobileQuickAddSlot />
      </div>
      <QuickAddDialog />
    </QuickAddProvider>
  );
}

function DesktopQuickAdd() {
  const { open } = useQuickAdd();
  return (
    <Button onClick={open} className="hidden sm:inline-flex" size="sm">
      <Plus className="h-4 w-4" />
      הוספה
    </Button>
  );
}

function MobileQuickAddSlot() {
  const { open } = useQuickAdd();
  return <NavBottom onQuickAdd={open} />;
}
