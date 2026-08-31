import { listTransactions } from "@/lib/queries/transactions";
import { Card } from "@/components/ui/card";
import { MonthNav } from "@/components/transactions/month-nav";
import { formatILS, formatDateIL } from "@/lib/utils";
import type { ScopeKeyParam } from "@/lib/nav";
import Link from "next/link";

const EFFECT_LABEL: Record<string, string> = {
  REAL_INCOME: "הכנסה",
  REAL_EXPENSE: "הוצאה",
  SAVINGS_INVESTMENT: "חיסכון/השקעה",
  ACCOUNT_TRANSFER: "העברה",
  REFUND: "החזר",
  CLIENT_EXPENSE: "הוצאה עבור לקוח",
  CLIENT_REIMBURSEMENT: "החזר מלקוח",
  TAX: "מס",
  OTHER: "אחר",
};

type Tx = Awaited<ReturnType<typeof listTransactions>>[number];

function groupByCategory(txs: Tx[]) {
  const groups = new Map<string, { name: string; icon: string; total: number; items: Tx[] }>();
  for (const t of txs) {
    const key = t.category?.id ?? "none";
    const name = t.category?.name ?? "לא מסווג";
    const icon = t.category?.icon ?? "❓";
    if (!groups.has(key)) groups.set(key, { name, icon, total: 0, items: [] });
    const g = groups.get(key)!;
    g.total += Number(t.amount);
    g.items.push(t);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; month?: string; category?: string; account?: string }>;
}) {
  const { scope, month, category, account } = await searchParams;
  const monthDate = month ? new Date(`${month}-01T00:00:00`) : new Date();

  const transactions = await listTransactions({
    scope: scope as ScopeKeyParam | undefined,
    monthDate,
    categoryId: category,
    accountKey: account,
  });

  const income = transactions.filter((t) => t.direction === "INCOME");
  const expense = transactions.filter((t) => t.direction === "EXPENSE");
  const other = transactions.filter((t) => t.direction !== "INCOME" && t.direction !== "EXPENSE");

  const total = transactions.reduce((s, t) => s + (t.direction === "EXPENSE" ? -Number(t.amount) : Number(t.amount)), 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <Card className="p-4">
        <MonthNav monthDate={monthDate} />
      </Card>

      <div className="flex items-center justify-between px-1 text-sm text-ink-soft">
        <span>{transactions.length} תנועות</span>
        <span className={`font-bold tabular-nums ${total >= 0 ? "text-income" : "text-expense"}`}>
          {formatILS(total)}
        </span>
      </div>

      {transactions.length === 0 ? (
        <Card className="p-8 text-center text-ink-faint">אין תנועות בחודש הזה.</Card>
      ) : (
        <>
          <CategorySection title="הכנסות" txs={income} tone="income" />
          <CategorySection title="הוצאות" txs={expense} tone="expense" />
          <CategorySection title="אחר" txs={other} tone="ink" />
        </>
      )}
    </div>
  );
}

function CategorySection({ title, txs, tone }: { title: string; txs: Tx[]; tone: "income" | "expense" | "ink" }) {
  if (txs.length === 0) return null;
  const groups = groupByCategory(txs);
  const sectionTotal = txs.reduce((s, t) => s + Number(t.amount), 0);
  const toneClass = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-ink";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-ink-faint">{title}</h2>
        <span className={`text-sm font-bold tabular-nums ${toneClass}`}>{formatILS(sectionTotal)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <Card key={g.name} className="overflow-hidden p-0">
            <details open={groups.length <= 3}>
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                  {g.icon}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{g.name}</span>
                <span className="text-xs text-ink-faint">{g.items.length}</span>
                <span className={`font-semibold tabular-nums ${toneClass}`}>{formatILS(g.total)}</span>
              </summary>
              <div className="divide-y divide-line border-t border-line">
                {g.items.map((t) => (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{t.vendor?.name ?? t.description ?? "ללא תיאור"}</div>
                      <div className="truncate text-xs text-ink-faint">
                        {formatDateIL(t.transactionDate)} · {t.scope.icon} {t.scope.name}
                        {t.economicEffect !== "REAL_EXPENSE" && t.economicEffect !== "REAL_INCOME"
                          ? ` · ${EFFECT_LABEL[t.economicEffect]}`
                          : ""}
                      </div>
                    </div>
                    <div className={`shrink-0 text-sm font-semibold tabular-nums ${toneClass}`}>
                      {formatILS(Number(t.amount))}
                    </div>
                  </Link>
                ))}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </section>
  );
}
