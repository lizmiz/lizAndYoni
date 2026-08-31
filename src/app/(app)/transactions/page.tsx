import { listTransactions } from "@/lib/queries/transactions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { MonthNav } from "@/components/transactions/month-nav";
import { TransactionContextMenu } from "@/components/transactions/context-menu";
import { formatILS, formatDateIL } from "@/lib/utils";
import { TRANSACTION_VIEWS, type ScopeKeyParam, type TransactionViewKey } from "@/lib/nav";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

function isExpectedStatus(t: Tx) {
  return t.status === "EXPECTED" || t.status === "PLANNED";
}

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
  searchParams: Promise<{ scope?: string; month?: string; category?: string; account?: string; view?: string }>;
}) {
  const { scope, month, category, account, view } = await searchParams;
  const monthDate = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const activeView: TransactionViewKey =
    view === "expected" || view === "expense" ? view : "income";

  const [transactions, rawCategories] = await Promise.all([
    listTransactions({
      scope: scope as ScopeKeyParam | undefined,
      monthDate,
      categoryId: category,
      accountKey: account,
    }),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } }),
  ]);

  const categoryById = new Map(rawCategories.map((c) => [c.id, c]));
  const categoryOptions = rawCategories
    .filter((c) => c.parentId)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentName: categoryById.get(c.parentId!)?.name }))
    .concat(
      rawCategories
        .filter((c) => !c.parentId && !rawCategories.some((child) => child.parentId === c.id))
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentName: undefined }))
    );

  // "הכנסות" = actually received only. "עתיד להיכנס" = still-pending income, kept entirely
  // separate so it never inflates the real income total. "הוצאות" = all expenses, any status.
  let viewTxs: Tx[];
  let tone: "income" | "expense";
  if (activeView === "income") {
    viewTxs = transactions.filter((t) => t.direction === "INCOME" && !isExpectedStatus(t));
    tone = "income";
  } else if (activeView === "expected") {
    viewTxs = transactions.filter((t) => t.direction === "INCOME" && isExpectedStatus(t));
    tone = "income";
  } else {
    viewTxs = transactions.filter((t) => t.direction === "EXPENSE");
    tone = "expense";
  }

  const total = transactions.reduce((s, t) => s + (t.direction === "EXPENSE" ? -Number(t.amount) : Number(t.amount)), 0);
  const viewTotal = viewTxs.reduce((s, t) => s + Number(t.amount), 0);
  const groups = groupByCategory(viewTxs);
  const toneClass = tone === "income" ? "text-income" : "text-expense";

  const qs = (v: string) => {
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope);
    if (month) params.set("month", month);
    params.set("view", v);
    return `/transactions?${params.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <Card className="p-4">
        <MonthNav monthDate={monthDate} />
      </Card>

      <div className="flex gap-2 overflow-x-auto">
        {TRANSACTION_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={qs(v.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              activeView === v.key ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft hover:bg-line"
            )}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 text-sm text-ink-soft">
        <span>{viewTxs.length} תנועות</span>
        <span className={`font-bold tabular-nums ${toneClass}`}>{formatILS(viewTotal)}</span>
      </div>
      <div className="px-1 text-xs text-ink-faint">מאזן כל התנועות בחודש (הכל): {formatILS(total)}</div>

      {viewTxs.length === 0 ? (
        <Card className="p-8 text-center text-ink-faint">אין תנועות בקטגוריה הזו החודש.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <Card key={g.name} className="overflow-hidden p-0">
              <details open={groups.length <= 3}>
                <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                    {g.icon}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-ink">{g.name}</span>
                  <span className="text-xs text-ink-faint">{g.items.length}</span>
                  <span className={`font-semibold tabular-nums ${toneClass}`}>{formatILS(g.total)}</span>
                </summary>
                <div className="divide-y divide-line border-t border-line">
                  {g.items.map((t) => (
                    <TransactionContextMenu key={t.id} transactionId={t.id} categories={categoryOptions}>
                      <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
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
                    </TransactionContextMenu>
                  ))}
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
