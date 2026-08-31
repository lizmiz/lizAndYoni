import { listTransactions } from "@/lib/queries/transactions";
import { Card } from "@/components/ui/card";
import { MonthNav } from "@/components/transactions/month-nav";
import { formatILS } from "@/lib/utils";
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

  const groups = new Map<string, typeof transactions>();
  for (const t of transactions) {
    const key = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" }).format(t.transactionDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

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
        [...groups.entries()].map(([date, txs]) => (
          <div key={date}>
            <div className="mb-2 px-1 text-xs font-semibold text-ink-faint">{date}</div>
            <Card className="divide-y divide-line overflow-hidden p-0">
              {txs.map((t) => (
                <Link
                  key={t.id}
                  href={`/transactions/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base">
                    {t.category?.icon ?? "❓"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {t.vendor?.name ?? t.description ?? "ללא תיאור"}
                    </div>
                    <div className="truncate text-xs text-ink-faint">
                      {t.category?.name ?? "לא מסווג"} · {t.scope.icon} {t.scope.name}
                      {t.economicEffect !== "REAL_EXPENSE" && t.economicEffect !== "REAL_INCOME"
                        ? ` · ${EFFECT_LABEL[t.economicEffect]}`
                        : ""}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 font-semibold tabular-nums ${
                      t.direction === "EXPENSE" ? "text-expense" : "text-income"
                    }`}
                  >
                    {t.direction === "EXPENSE" ? "-" : "+"}
                    {formatILS(Number(t.amount))}
                  </div>
                </Link>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
