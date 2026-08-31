"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { addMonths, format } from "date-fns";

export function MonthNav({ monthDate }: { monthDate: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(delta: number) {
    const next = addMonths(monthDate, delta);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(next, "yyyy-MM"));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between">
      <button onClick={() => go(-1)} className="rounded-full p-2 hover:bg-surface-2" aria-label="חודש קודם">
        <ChevronRight className="h-5 w-5 text-ink-soft" />
      </button>
      <div className="font-bold text-ink">{format(monthDate, "MM/yyyy")}</div>
      <button onClick={() => go(1)} className="rounded-full p-2 hover:bg-surface-2" aria-label="חודש הבא">
        <ChevronLeft className="h-5 w-5 text-ink-soft" />
      </button>
    </div>
  );
}
