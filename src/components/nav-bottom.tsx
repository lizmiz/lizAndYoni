"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, MoreHorizontal } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function NavBottom({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-surface/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {primary.slice(0, 2).map((item) => (
        <NavLink key={item.href} item={item} active={pathname === item.href} />
      ))}

      <button
        onClick={onQuickAdd}
        aria-label="הוספה מהירה"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Plus className="h-5 w-5" />
        </span>
      </button>

      {primary.slice(2).map((item) => (
        <NavLink key={item.href} item={item} active={pathname === item.href} />
      ))}

      <Link
        href="/more"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
          pathname === "/more" ? "text-accent" : "text-ink-faint"
        )}
      >
        <MoreHorizontal className="h-5 w-5" />
        עוד
      </Link>
    </nav>
  );
}

function NavLink({ item, active }: { item: (typeof NAV_ITEMS)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
        active ? "text-accent" : "text-ink-faint"
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}
