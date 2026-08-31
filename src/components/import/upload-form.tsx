"use client";

import { useActionState } from "react";
import { importCreditCardFile, type ImportResult } from "@/lib/actions/import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

const initial: ImportResult = { ok: false };

export function ImportUploadForm({ creditCards }: { creditCards: { id: string; name: string; last4: string }[] }) {
  const [state, formAction, isPending] = useActionState(importCreditCardFile, initial);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">קובץ פירוט עסקאות (Excel מ-MAX)</span>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx,.xls"
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none file:me-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1 file:text-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">כרטיס (ברירת מחדל לעסקאות שלא מזוהות אוטומטית)</span>
          <select name="creditCardId" required className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} •••{c.last4}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" disabled={isPending}>
          {isPending ? "מייבא…" : "ייבוא"}
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
            הייבוא הושלם — {state.cardName}
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-faint">עסקאות שיובאו</dt>
            <dd className="text-ink">{state.imported}</dd>
            <dt className="text-ink-faint">כפילויות שדולגו</dt>
            <dd className="text-ink">{state.duplicatesSkipped}</dd>
            <dt className="text-ink-faint">דורשות סיווג</dt>
            <dd className="text-ink">{state.uncategorized}</dd>
            <dt className="text-ink-faint">עסקאות עתידיות (טרם נקלטו)</dt>
            <dd className="text-ink">{state.pendingImported}</dd>
            <dt className="text-ink-faint">סכום מותאם</dt>
            <dd className="font-semibold text-ink">{formatILS(state.matchedAmount ?? 0)}</dd>
          </dl>
        </Card>
      )}
    </div>
  );
}
