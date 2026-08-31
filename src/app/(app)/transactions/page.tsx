import { listTransactions } from "@/lib/queries/transactions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { MonthNav } from "@/components/transactions/month-nav";
import { TransactionContextMenu } from "@/components/transactions/context-menu";
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

function groupByVendor(txs: Tx[]) {
  const groups = new Map<string, { name: string; icon: string; total: number; items: Tx[] }>();
  for (const t of txs) {
    const name = t.vendor?.name ?? t.description ?? "ללא שם";
    const key = name;
    if (!groups.has(key)) groups.set(key, { name, icon: "👤", total: 0, items: [] });
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
    .filter((c) => c.parentId) // only leaf categories are assignable — matches quick-add
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentName: categoryById.get(c.parentId!)?.name }))
    .concat(
      rawCategories
        .filter((c) => !c.parentId && !rawCategories.some((child) => child.parentId === c.id))
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, parentName: undefined }))
    );

  const income = transactions.filter((t) => t.direction === "INCOME");
  const expense = transactions.filter((t) => t.direction === "EXPENSE");
  const other = transactions.filter((t) => t.direction !== "INCOME" && t.direction !== "EXPENSE");

  const total = transactions.reduce((s, t) => s + (t.direction === "EXPENSE" ? -Number(t.amount) : Number(t.amount)), 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-4">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CategorySection title="הכנסות" txs={income} tone="income" categoryOptions={categoryOptions} groupBy="vendor" />
          <CategorySection title="הוצאות" txs={expense} tone="expense" categoryOptions={categoryOptions} groupBy="category" />
        </div>
      )}
      {other.length > 0 && (
        <CategorySection title="אחר" txs={other} tone="ink" categoryOptions={categoryOptions} groupBy="category" />
      )}
    </div>
  );
}

function isExpectedStatus(t: Tx) {
  return t.status === "EXPECTED" || t.status === "PLANNED";
}

function CategorySection({
  title,
  txs,
  tone,
  categoryOptions,
  groupBy,
}: {
  title: string;
  txs: Tx[];
  tone: "income" | "expense" | "ink";
  categoryOptions: { id: string; name: string; icon: string | null; parentName?: string }[];
  groupBy: "category" | "vendor";
}) {
  if (txs.length === 0) return null;
  const actualTxs = txs.filter((t) => !isExpectedStatus(t));
  const expectedTxs = txs.filter(isExpectedStatus);
  const sectionTotal = txs.reduce((s, t) => s + Number(t.amount), 0);
  const toneClass = tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-ink";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-ink-faint">{title}</h2>
        <span className={`text-sm font-bold tabular-nums ${toneClass}`}>{formatILS(sectionTotal)}</span>
      </div>

      {actualTxs.length > 0 && (
        <TransactionGroups txs={actualTxs} groupBy={groupBy} toneClass={toneClass} categoryOptions={categoryOptions} />
      )}

      {expectedTxs.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-gold">
            <span className="h-2 w-2 rounded-full bg-gold" />
            צפוי {tone === "income" ? "להיכנס" : tone === "expense" ? "לרדת" : ""}
          </div>
          <TransactionGroups txs={expectedTxs} groupBy={groupBy} toneClass="text-gold" categoryOptions={categoryOptions} />
        </div>
      )}
    </section>
  );
}

function TransactionGroups({
  txs,
  groupBy,
  toneClass,
  categoryOptions,
}: {
  txs: Tx[];
  groupBy: "category" | "vendor";
  toneClass: string;
  categoryOptions: { id: string; name: string; icon: string | null; parentName?: string }[];
}) {
  const groups = groupBy === "vendor" ? groupByVendor(txs) : groupByCategory(txs);

  return (
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
                      <div className="truncate text-sm text-ink">
                        {groupBy === "vendor" ? (t.category?.name ?? "לא מסווג") : (t.vendor?.name ?? t.description ?? "ללא תיאור")}
                      </div>
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
  );
}
