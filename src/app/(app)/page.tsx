import { getDashboardData, type CategoryBreakdownItem, type DashboardInsight } from "@/lib/queries/dashboard";
import { Card } from "@/components/ui/card";
import { formatILS, formatDateIL } from "@/lib/utils";
import type { ScopeKeyParam } from "@/lib/nav";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const data = await getDashboardData(scope as ScopeKeyParam | undefined);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="יתרה נוכחית"
          value={data.currentBalance}
          tone="ink"
          caption={data.activeScope ? "כל החשבונות — הכסף משותף" : undefined}
        />
        <Kpi label={`צפוי להיכנס עד ${formatDateIL(data.monthEnd)}`} value={data.expectedIncomeRemaining} tone="income" />
        <Kpi label={`צפוי לרדת עד ${formatDateIL(data.monthEnd)}`} value={data.expectedExpenseRemaining} tone="expense" />
        <Kpi label="תחזית לסוף החודש" value={data.forecastEndOfMonth} tone="forecast" highlight />
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SubStat label="הכנסות החודש" value={data.monthActualIncome} />
        <SubStat label="הוצאות החודש" value={data.monthActualExpense} />
        <SubStat label="מאזן החודש" value={data.monthBalance} signed />
        <SubStat label="חיסכון והשקעות" value={data.monthSavings} />
      </div>

      {/* Category breakdown */}
      <Card className="p-5">
        <h2 className="mb-4 font-bold text-ink">לאן הלך הכסף — לפי קטגוריה</h2>
        {data.categoryBreakdown.length === 0 ? (
          <p className="text-sm text-ink-faint">אין עדיין הוצאות מסווגות בחודש הזה.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.categoryBreakdown.map((c: CategoryBreakdownItem) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0 truncate text-sm text-ink">
                  {c.icon} {c.name}
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (c.amount / data.maxCategoryAmount) * 100)}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-left text-sm tabular-nums text-ink">{formatILS(c.amount)}</div>
                <div
                  className={`w-16 shrink-0 text-xs font-bold tabular-nums ${
                    c.deltaPct >= 0 ? "text-expense" : "text-income"
                  }`}
                >
                  {c.priorAvg > 0 ? `${c.deltaPct >= 0 ? "↑" : "↓"} ${Math.round(Math.abs(c.deltaPct))}%` : "חדש"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Insights */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="font-bold text-ink">התובנות שלי</h2>
        </div>
        {data.insights.length === 0 ? (
          <p className="text-sm text-ink-faint">אין תובנות חדשות כרגע.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.insights.map((insight: DashboardInsight, i: number) => (
              <div
                key={i}
                className={`rounded-xl px-4 py-3 text-sm ${
                  insight.severity === "critical"
                    ? "bg-expense-soft text-expense"
                    : insight.severity === "warning"
                      ? "bg-gold-soft text-gold"
                      : "bg-surface-2 text-ink-soft"
                }`}
              >
                {insight.text}
              </div>
            ))}
          </div>
        )}
        <Link href="/insights" className="mt-3 inline-block text-sm font-semibold text-accent">
          לכל התובנות ←
        </Link>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  highlight,
  caption,
}: {
  label: string;
  value: number;
  tone: "ink" | "income" | "expense" | "forecast";
  highlight?: boolean;
  caption?: string;
}) {
  const toneClass = {
    ink: "text-ink",
    income: "text-income",
    expense: "text-expense",
    forecast: "text-accent",
  }[tone];

  return (
    <Card className={`p-4 ${highlight ? "bg-accent-soft border-accent/30" : ""}`}>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${toneClass}`}>{formatILS(value)}</div>
      {caption && <div className="mt-0.5 text-[11px] text-ink-faint">{caption}</div>}
    </Card>
  );
}

function SubStat({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const color = signed ? (value >= 0 ? "text-income" : "text-expense") : "text-ink";
  return (
    <Card className="p-3">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-1 text-base font-semibold tabular-nums ${color}`}>
        {signed && value > 0 ? "+" : ""}
        {formatILS(value)}
      </div>
    </Card>
  );
}
