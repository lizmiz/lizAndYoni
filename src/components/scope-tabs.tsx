"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SCOPES } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function ScopeTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("scope") ?? "all";

  function select(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") params.delete("scope");
    else params.set("scope", key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6" role="tablist" aria-label="סינון לפי שיוך פיננסי">
      {SCOPES.map((s) => (
        <button
          key={s.key}
          role="tab"
          aria-selected={current === s.key}
          onClick={() => select(s.key)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
            current === s.key
              ? "bg-ink text-bg"
              : "bg-surface-2 text-ink-soft hover:bg-line"
          )}
        >
          {s.icon ? `${s.icon} ` : ""}
          {s.label}
        </button>
      ))}
    </div>
  );
}
