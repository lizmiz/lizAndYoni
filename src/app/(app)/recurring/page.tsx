import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatILS } from "@/lib/utils";
import { createRecurring, toggleRecurringActive, markRecurringReceived } from "@/lib/actions/recurring";
import { startOfMonth, endOfMonth } from "date-fns";
import { AlertTriangle } from "lucide-react";

async function handleCreateRecurring(formData: FormData) {
  "use server";
  await createRecurring(formData);
}

export default async function RecurringPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [definitions, scopes, categories, bankAccounts, monthTx] = await Promise.all([
    prisma.recurringDefinition.findMany({ where: { isActive: true }, include: { scope: true }, orderBy: { expectedDay: "asc" } }),
    prisma.financialScope.findMany(),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
    prisma.transaction.findMany({
      where: { transactionDate: { gte: monthStart, lte: monthEnd }, recurringDefinitionId: { not: null } },
      select: { recurringDefinitionId: true },
    }),
  ]);

  const receivedIds = new Set(monthTx.map((t) => t.recurringDefinitionId));
  const overdue = definitions.filter(
    (d) => d.direction === "INCOME" && d.expectedDay < now.getDate() && !receivedIds.has(d.id)
  );

  const income = definitions.filter((d) => d.direction === "INCOME");
  const expense = definitions.filter((d) => d.direction === "EXPENSE");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">הכנסות והוצאות קבועות</h1>

      {overdue.map((d) => (
        <Card key={d.id} className="flex items-center gap-3 border-expense/30 bg-expense-soft p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-expense" />
          <div className="flex-1 text-sm text-expense">
            {d.name} בסך {formatILS(Number(d.amount))} היה צפוי ב-{d.expectedDay} לחודש ועדיין לא סומן כהתקבל.
          </div>
        </Card>
      ))}

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-faint">הכנסות קבועות</h2>
        <div className="flex flex-col gap-2">
          {income.map((d) => (
            <RecurringRow key={d.id} def={d} received={receivedIds.has(d.id)} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink-faint">הוצאות קבועות</h2>
        <div className="flex flex-col gap-2">
          {expense.map((d) => (
            <RecurringRow key={d.id} def={d} received={receivedIds.has(d.id)} />
          ))}
        </div>
      </section>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת פריט קבוע</summary>
          <form action={handleCreateRecurring} className="mt-3 flex flex-col gap-3">
            <input name="name" required placeholder="שם (למשל: משכנתא)" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <div className="flex gap-2">
              <select name="direction" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
                <option value="EXPENSE">הוצאה</option>
                <option value="INCOME">הכנסה</option>
              </select>
              <input name="amount" type="number" step="0.01" required placeholder="סכום" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="expectedDay" type="number" min={1} max={31} required placeholder="יום בחודש" className="w-24 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <select name="scopeId" required className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <select name="categoryId" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              <option value="">קטגוריה (לא חובה)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            <select name="bankAccountId" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              <option value="">חשבון (לא חובה)</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}

function RecurringRow({
  def,
  received,
}: {
  def: { id: string; name: string; amount: unknown; expectedDay: number; scope: { icon: string; name: string } };
  received: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex-1">
        <div className="font-medium text-ink">{def.name}</div>
        <div className="text-xs text-ink-faint">
          יום {def.expectedDay} לחודש · {def.scope.icon} {def.scope.name}
        </div>
      </div>
      <div className="font-bold tabular-nums text-ink">{formatILS(Number(def.amount))}</div>
      {received ? (
        <span className="rounded-full bg-income-soft px-3 py-1 text-xs font-semibold text-income">בוצע החודש</span>
      ) : (
        <form action={markRecurringReceived.bind(null, def.id)}>
          <Button type="submit" size="sm" variant="outline">
            סימון כבוצע
          </Button>
        </form>
      )}
      <form action={toggleRecurringActive.bind(null, def.id, false)}>
        <button type="submit" className="text-xs text-ink-faint hover:text-expense">
          כיבוי
        </button>
      </form>
    </Card>
  );
}
