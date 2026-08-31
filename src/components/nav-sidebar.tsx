"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";

export function NavSidebar({ user }: { user: Session["user"] | undefined }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line bg-surface sm:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-2xl">🧭</span>
        <span className="font-bold text-ink">מצפן פיננסי</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-2"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
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
