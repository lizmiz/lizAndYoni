import { getDashboardData } from "@/lib/queries/dashboard";
import { Card } from "@/components/ui/card";
import type { ScopeKeyParam } from "@/lib/nav";
import { AiInsightsPanel, AskQuestionPanel } from "@/components/insights/ai-panel";
import { Lightbulb } from "lucide-react";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const data = await getDashboardData(scope as ScopeKeyParam | undefined);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">התובנות שלי</h1>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" />
          <h2 className="font-bold text-ink">מבוסס נתונים</h2>
        </div>
        {data.insights.length === 0 ? (
          <p className="text-sm text-ink-faint">אין תובנות חדשות כרגע — הכל נראה תקין.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.insights.map((insight, i) => (
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
      </Card>

      <AiInsightsPanel scope={scope} />
      <AskQuestionPanel scope={scope} />
    </div>
  );
}
