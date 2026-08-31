"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { Suspense } from "react";

export function NavSidebar({ user }: { user: Session["user"] | undefined }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line bg-surface sm:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-2xl">🧭</span>
        <span className="font-bold text-ink">מצפן פיננסי</span>
      </div>
      <Suspense>
        <NavLinks />
      </Suspense>
      {user && (
        <div className="flex items-center gap-2 border-t border-line px-5 py-4 text-sm text-ink-soft">
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
          )}
          <span className="truncate">{user.name ?? user.email}</span>
        </div>
      )}
    </aside>
  );
}

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href && !item.children;
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-2"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
            {item.children && pathname === "/transactions" && (
              <div className="me-4 mt-1 flex flex-col gap-0.5 border-e border-line pe-3">
                {item.children.map((child) => {
                  const childView = new URL(child.href, "http://x").searchParams.get("view");
                  const childActive = currentView === childView || (!currentView && childView === "income");
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm transition-colors",
                        childActive ? "font-semibold text-accent" : "text-ink-faint hover:text-ink"
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
