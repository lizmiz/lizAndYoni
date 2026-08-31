"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useQuickAdd } from "./context";
import { createQuickTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";

type FormState = { ok: boolean; error?: string };
const initialState: FormState = { ok: false, error: undefined };

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function QuickAddForm({ onDone }: { onDone: () => void }) {
  const { referenceData } = useQuickAdd();
  const { scopes, categories, bankAccounts, creditCards, vendors } = referenceData;

  const [direction, setDirection] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const parentCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);
  const standaloneCategories = useMemo(
    () => categories.filter((c) => !c.parentId && childrenOf(c.id).length === 0),
    [categories]
  );

  const accountOptions = [
    ...bankAccounts.map((a) => ({ key: `bank:${a.id}`, label: `${a.name} (חשבון בנק)` })),
    ...creditCards.map((c) => ({ key: `card:${c.id}`, label: `${c.name} •••${c.last4}` })),
  ];

  const [state, formAction, isPending] = useActionState(async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const result = await createQuickTransaction(formData);
    if (result.ok) {
      formRef.current?.reset();
      setVendorName("");
      setCategoryId("");
      onDone();
    }
    return result;
  }, initialState);

  function handleVendorBlur() {
    const normalized = vendorName.toLowerCase().replace(/\s+/g, "");
    const match = vendors.find((v) => v.normalizedName === normalized);
    if (match) {
      if (match.defaultCategoryId) setCategoryId(match.defaultCategoryId);
      if (match.defaultScopeId) setScopeId(match.defaultScopeId);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-full bg-surface-2 p-1">
        {(["EXPENSE", "INCOME"] as const).map((d) => (
          <label
            key={d}
            className={`cursor-pointer rounded-full py-2 text-center text-sm font-semibold transition-colors ${
              direction === d ? "bg-ink text-bg" : "text-ink-soft"
            }`}
          >
            <input
              type="radio"
              name="direction"
              value={d}
              checked={direction === d}
              onChange={() => setDirection(d)}
              className="sr-only"
            />
            {d === "EXPENSE" ? "הוצאה" : "הכנסה"}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-lg font-semibold tabular-nums outline-none focus:border-accent"
          />
        </Field>
        <Field label="תאריך">
          <input
            name="transactionDate"
            type="date"
            required
            defaultValue={todayISO()}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
          />
        </Field>
      </div>

      <Field label="ספק / לקוח">
        <input
          name="vendorName"
          list="vendor-list"
          required
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          onBlur={handleVendorBlur}
          placeholder="לדוגמה: Wolt, רמי לוי…"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        <datalist id="vendor-list">
          {vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>
      </Field>

      <Field label="שיוך">
        <div className="flex gap-2">
          {scopes.map((s) => (
            <label
              key={s.id}
              className={`flex-1 cursor-pointer rounded-xl border py-2 text-center text-sm font-medium transition-colors ${
                scopeId === s.id ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft"
              }`}
            >
              <input
                type="radio"
                name="scopeId"
                value={s.id}
                checked={scopeId === s.id}
                onChange={() => setScopeId(s.id)}
                className="sr-only"
              />
              {s.icon} {s.name}
            </label>
          ))}
        </div>
      </Field>

      <Field label="קטגוריה">
        <select
          name="categoryId"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
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
          <optgroup label="אחר">
            {standaloneCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field label="חשבון / כרטיס">
        <select
          name="accountKey"
          required
          defaultValue={accountOptions[0]?.key}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        >
          {accountOptions.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="הערה (לא חובה)">
        <input
          name="notes"
          type="text"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
        />
      </Field>

      {state.error && <p className="text-sm text-expense">{state.error}</p>}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "שומר…" : "שמירה"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
