"use client";

import { useActionState } from "react";
import { importHistoricalLedger, type HistoryImportResult } from "@/lib/actions/import-history";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

const initial: HistoryImportResult = { ok: false };

export function HistoryUploadForm() {
  const [state, formAction, isPending] = useActionState(importHistoricalLedger, initial);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">קובץ Excel של הגיליון ההיסטורי</span>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx,.xls"
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none file:me-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
          />
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? "מייבא… (יכול לקחת דקה)" : "ייבוא היסטוריה"}
        </Button>
      </form>

      {state.error && (
        <Card className="flex items-center gap-2 border-expense/30 bg-expense-soft p-4 text-sm text-expense">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </Card>
      )}

      {state.ok && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-income">
            <CheckCircle2 className="h-5 w-5" />
            הייבוא הושלם
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-faint">חודשים שעובדו</dt>
            <dd className="text-ink">{state.tabsProcessed}</dd>
            <dt className="text-ink-faint">תנועות שיובאו</dt>
            <dd className="text-ink">{state.imported}</dd>
            <dt className="text-ink-faint">כפילויות שדולגו</dt>
            <dd className="text-ink">{state.duplicatesSkipped}</dd>
            <dt className="text-ink-faint">דורשות סיווג</dt>
            <dd className="text-ink">{state.uncategorized}</dd>
          </dl>
          {state.tabsSkipped && state.tabsSkipped.length > 0 && (
            <p className="mt-3 text-xs text-ink-faint">
              {state.tabsSkipped.length} חודשים ישנים דולגו (פורמט שונה מתקופה מוקדמת יותר): {state.tabsSkipped.join(", ")}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
