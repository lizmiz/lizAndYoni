"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateTransaction, deleteTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import type { Category } from "@prisma/client";

const EFFECT_OPTIONS: { value: string; label: string }[] = [
  { value: "REAL_INCOME", label: "הכנסה אמיתית" },
  { value: "REAL_EXPENSE", label: "הוצאה אמיתית" },
  { value: "SAVINGS_INVESTMENT", label: "חיסכון / השקעה" },
  { value: "ACCOUNT_TRANSFER", label: "העברה בין חשבונות" },
  { value: "REFUND", label: "החזר" },
  { value: "CLIENT_EXPENSE", label: "הוצאה עבור לקוח" },
  { value: "CLIENT_REIMBURSEMENT", label: "כסף שהתקבל עבור הוצאות לקוח" },
  { value: "TAX", label: "מס" },
  { value: "OTHER", label: "תנועה אחרת" },
];

type FormState = { ok: boolean; error?: string };

export function TransactionEditForm({
  transactionId,
  categories,
  currentCategoryId,
  currentEffect,
  currentNotes,
}: {
  transactionId: string;
  categories: Category[];
  currentCategoryId: string;
  currentEffect: string;
  currentNotes: string;
}) {
  const router = useRouter();
  const parentCategories = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    return updateTransaction(formData);
  }, { ok: false });

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={transactionId} />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">קטגוריה</span>
          <select
            name="categoryId"
            defaultValue={currentCategoryId}
            required
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          >
            <option value="" disabled>
              בחירת קטגוריה…
            </option>
            {parentCategories.map((p) => {
              const kids = childrenOf(p.id);
              if (kids.length === 0) return null;
              return (
                <optgroup key={p.id} label={`${p.icon ?? ""} ${p.name}`}>
                  {kids.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">השפעה כלכלית</span>
          <select
            name="economicEffect"
            defaultValue={currentEffect}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          >
            {EFFECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink-soft">הערה</span>
          <input
            name="notes"
            type="text"
            defaultValue={currentNotes}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        {state.error && <p className="text-sm text-expense">{state.error}</p>}

        <Button type="submit" disabled={isPending}>
          {isPending ? "שומר…" : "עדכון"}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="text-expense"
        onClick={async () => {
          if (confirm("למחוק את התנועה? הפעולה בלתי הפיכה.")) {
            await deleteTransaction(transactionId);
            router.push("/transactions");
          }
        }}
      >
        מחיקת תנועה
      </Button>
    </div>
  );
}
