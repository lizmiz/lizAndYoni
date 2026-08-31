import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { ScopeKeyParam } from "@/lib/nav";
import type { FinancialScope } from "@prisma/client";

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  icon: string | null;
  amount: number;
  priorAvg: number;
  deltaPct: number;
}

export interface DashboardInsight {
  text: string;
  severity: "info" | "warning" | "critical";
}

export interface DashboardStats {
  scopes: FinancialScope[];
  activeScope: FinancialScope | null;
  currentBalance: number;
  expectedIncomeRemaining: number;
  expectedExpenseRemaining: number;
  forecastEndOfMonth: number;
  monthActualIncome: number;
  monthActualExpense: number;
  monthBalance: number;
  monthSavings: number;
  categoryBreakdown: CategoryBreakdownItem[];
  maxCategoryAmount: number;
  monthEnd: Date;
}

export type DashboardData = DashboardStats & { insights: DashboardInsight[] };

function num(d: unknown): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d);
}

export async function resolveScopeIds(scopeParam: ScopeKeyParam | undefined) {
  const scopes = await prisma.financialScope.findMany();
  if (!scopeParam || scopeParam === "all") {
    return { scopes, scopeIds: scopes.map((s) => s.id), activeScope: null };
  }
  const active = scopes.find((s) => s.key === scopeParam) ?? null;
  return { scopes, scopeIds: active ? [active.id] : [], activeScope: active };
}

export async function getDashboardData(scopeParam: ScopeKeyParam | undefined): Promise<DashboardData> {
  const { scopes, scopeIds, activeScope } = await resolveScopeIds(scopeParam);
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [accounts, monthTx, expectedRecurring, expectedTx, cmpTx] = await Promise.all([
    prisma.bankAccount.findMany({ where: { isActive: true } }),
    prisma.transaction.findMany({
      where: {
        scopeId: { in: scopeIds },
        transactionDate: { gte: monthStart, lte: monthEnd },
        status: "ACTUAL",
      },
      include: { category: { include: { parent: true } } },
    }),
    prisma.recurringDefinition.findMany({
      where: { scopeId: { in: scopeIds }, isActive: true, expectedDay: { gte: now.getDate() } },
    }),
    prisma.transaction.findMany({
      where: {
        scopeId: { in: scopeIds },
        transactionDate: { gte: monthStart, lte: monthEnd },
        status: { in: ["EXPECTED", "PLANNED"] },
      },
    }),
    prisma.transaction.findMany({
      where: {
        scopeId: { in: scopeIds },
        transactionDate: { gte: startOfMonth(subMonths(now, 3)), lt: monthStart },
        status: "ACTUAL",
        economicEffect: "REAL_EXPENSE",
      },
      include: { category: { include: { parent: true } } },
    }),
  ]);

  const currentBalance = accounts.reduce((sum, a) => sum + num(a.currentBalance), 0);

  const monthActualIncome = monthTx
    .filter((t) => t.economicEffect === "REAL_INCOME")
    .reduce((s, t) => s + num(t.amount), 0);
  const monthActualExpense = monthTx
    .filter((t) => t.economicEffect === "REAL_EXPENSE")
    .reduce((s, t) => s + num(t.amount), 0);
  const monthSavings = monthTx
    .filter((t) => t.economicEffect === "SAVINGS_INVESTMENT")
    .reduce((s, t) => s + num(t.amount), 0);

  const expectedIncomeRemaining =
    expectedRecurring.filter((r) => r.direction === "INCOME").reduce((s, r) => s + num(r.amount), 0) +
    expectedTx.filter((t) => t.direction === "INCOME").reduce((s, t) => s + num(t.amount), 0);
  const expectedExpenseRemaining =
    expectedRecurring.filter((r) => r.direction === "EXPENSE").reduce((s, r) => s + num(r.amount), 0) +
    expectedTx.filter((t) => t.direction === "EXPENSE").reduce((s, t) => s + num(t.amount), 0);

  const forecastEndOfMonth = currentBalance + expectedIncomeRemaining - expectedExpenseRemaining;

  // ── Category breakdown (this month vs. average of prior 3 months) ──
  type CatAgg = { id: string; name: string; icon: string | null; amount: number };
  const topOf = (cat: { id: string; name: string; icon: string | null; parent: { id: string; name: string; icon: string | null } | null }) =>
    cat.parent ?? cat;

  const thisMonthByCat = new Map<string, CatAgg>();
  for (const t of monthTx) {
    if (t.economicEffect !== "REAL_EXPENSE" || !t.category) continue;
    const top = topOf(t.category);
    const row = thisMonthByCat.get(top.id) ?? { id: top.id, name: top.name, icon: top.icon, amount: 0 };
    row.amount += num(t.amount);
    thisMonthByCat.set(top.id, row);
  }

  const priorByCat = new Map<string, number>();
  for (const t of cmpTx) {
    if (!t.category) continue;
    const top = topOf(t.category);
    priorByCat.set(top.id, (priorByCat.get(top.id) ?? 0) + num(t.amount));
  }

  const categoryBreakdown = [...thisMonthByCat.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => {
      const priorTotal = priorByCat.get(c.id) ?? 0;
      const priorAvg = priorTotal / 3;
      const deltaPct = priorAvg > 0 ? ((c.amount - priorAvg) / priorAvg) * 100 : c.amount > 0 ? 100 : 0;
      return { ...c, priorAvg, deltaPct };
    });

  const maxCategoryAmount = Math.max(1, ...categoryBreakdown.map((c) => c.amount));

  const result: DashboardStats = {
    scopes,
    activeScope,
    currentBalance,
    expectedIncomeRemaining,
    expectedExpenseRemaining,
    forecastEndOfMonth,
    monthActualIncome,
    monthActualExpense,
    monthBalance: monthActualIncome - monthActualExpense,
    monthSavings,
    categoryBreakdown,
    maxCategoryAmount,
    monthEnd,
  };

  return { ...result, insights: buildBasicInsights(result) };
}

function buildBasicInsights(d: DashboardStats): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString("he-IL");

  if (d.expectedExpenseRemaining > 0 || d.expectedIncomeRemaining > 0) {
    insights.push({
      text: `נותרו עוד ${fmt(d.expectedExpenseRemaining)} ₪ של חיובים צפויים עד סוף החודש, לצד ${fmt(
        d.expectedIncomeRemaining
      )} ₪ הכנסות צפויות.`,
      severity: "info",
    });
  }

  if (d.forecastEndOfMonth < 0) {
    insights.push({
      text: `בקצב הנוכחי אתם צפויים לסיים את החודש בגירעון של כ-${fmt(d.forecastEndOfMonth)} ₪.`,
      severity: "critical",
    });
  } else if (d.forecastEndOfMonth < d.currentBalance * 0.3) {
    insights.push({
      text: `היתרה הצפויה לסוף החודש נמוכה יחסית — כ-${fmt(d.forecastEndOfMonth)} ₪. כדאי לעקוב.`,
      severity: "warning",
    });
  }

  const overspend = d.categoryBreakdown.find((c) => c.priorAvg > 0 && c.deltaPct >= 30);
  if (overspend) {
    insights.push({
      text: `הוצאתם ${fmt(overspend.amount - overspend.priorAvg)} ₪ יותר מהרגיל על ${overspend.name} החודש (עלייה של ${Math.round(
        overspend.deltaPct
      )}%).`,
      severity: "warning",
    });
  }

  if (d.monthSavings > 0) {
    insights.push({
      text: `${fmt(d.monthSavings)} ₪ הועברו לחיסכון והשקעות החודש.`,
      severity: "info",
    });
  }

  return insights;
}
