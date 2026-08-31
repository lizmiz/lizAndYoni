import { prisma } from "@/lib/prisma";
import { startOfMonth, subMonths } from "date-fns";
import type { ScopeKeyParam } from "@/lib/nav";
import { resolveScopeIds } from "@/lib/queries/dashboard";

/** Compact JSON-able summary of the last N months, grounding data for Claude. */
export async function buildFinancialContext(scopeParam: ScopeKeyParam | undefined, months = 6) {
  const { scopeIds, activeScope } = await resolveScopeIds(scopeParam);
  const since = startOfMonth(subMonths(new Date(), months - 1));

  const [transactions, recurring, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: { scopeId: { in: scopeIds }, transactionDate: { gte: since }, status: "ACTUAL" },
      include: { category: { include: { parent: true } } },
    }),
    prisma.recurringDefinition.findMany({ where: { scopeId: { in: scopeIds }, isActive: true } }),
    prisma.bankAccount.findMany({ where: { isActive: true } }),
  ]);

  const byMonth = new Map<string, { income: number; expense: number; savings: number; byCategory: Record<string, number> }>();
  for (const t of transactions) {
    const key = `${t.transactionDate.getFullYear()}-${String(t.transactionDate.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, { income: 0, expense: 0, savings: 0, byCategory: {} });
    const bucket = byMonth.get(key)!;
    const amount = Number(t.amount);
    if (t.economicEffect === "REAL_INCOME") bucket.income += amount;
    else if (t.economicEffect === "REAL_EXPENSE") {
      bucket.expense += amount;
      const catName = t.category?.parent?.name ?? t.category?.name ?? "לא מסווג";
      bucket.byCategory[catName] = (bucket.byCategory[catName] ?? 0) + amount;
    } else if (t.economicEffect === "SAVINGS_INVESTMENT") bucket.savings += amount;
  }

  const currentBalance = accounts.reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);

  return {
    scope: activeScope?.name ?? "הכל",
    currentBalance,
    months: Object.fromEntries([...byMonth.entries()].sort()),
    recurringDefinitions: recurring.map((r) => ({
      name: r.name,
      amount: Number(r.amount),
      direction: r.direction,
      day: r.expectedDay,
    })),
  };
}
