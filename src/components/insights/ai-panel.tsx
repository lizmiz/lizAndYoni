"use client";

import { useActionState } from "react";
import { generateAiInsights, askFinancialQuestion } from "@/lib/actions/insights";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Send } from "lucide-react";
import type { ScopeKeyParam } from "@/lib/nav";

type InsightsState = { ok: boolean; insights?: string[]; reason?: "no-key" | "error" };
type QaState = { ok: boolean; answer?: string; error?: string };

export function AiInsightsPanel({ scope }: { scope?: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: InsightsState): Promise<InsightsState> => generateAiInsights(scope as ScopeKeyParam | undefined),
    { ok: false }
  );

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="font-bold text-ink">תובנות AI</h2>
        </div>
        <form action={formAction}>
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            {isPending ? "חושב…" : "יצירת תובנות"}
          </Button>
        </form>
      </div>

      {state.reason === "no-key" && (
        <p className="text-sm text-ink-faint">
          מפתח Claude API עדיין לא הוגדר בשרת — לכשיוגדר, כאן יופיעו תובנות מבוססות-AI על הנתונים שלכם.
        </p>
      )}
      {state.reason === "error" && <p className="text-sm text-expense">משהו השתבש בקריאה ל-AI. נסו שוב.</p>}
      {state.ok && state.insights && (
        <div className="flex flex-col gap-2">
          {state.insights.map((line, i) => (
            <div key={i} className="rounded-xl bg-gold-soft px-4 py-3 text-sm text-gold">
              {line}
            </div>
          ))}
        </div>
      )}
      {!state.ok && !state.reason && (
        <p className="text-sm text-ink-faint">לחצו על &quot;יצירת תובנות&quot; לניתוח AI של הנתונים האחרונים.</p>
      )}
    </Card>
  );
}

export function AskQuestionPanel({ scope }: { scope?: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: QaState, formData: FormData): Promise<QaState> => askFinancialQuestion(formData),
    { ok: false }
  );

  return (
    <Card className="p-5">
      <h2 className="mb-3 font-bold text-ink">שאלו את המערכת</h2>
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="scope" value={scope ?? ""} />
        <input
          name="question"
          placeholder="לדוגמה: כמה הוצאנו על אוכל בחוץ ב-3 החודשים האחרונים?"
          className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" size="md" disabled={isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      {isPending && <p className="mt-3 text-sm text-ink-faint">חושב…</p>}
      {state.error && <p className="mt-3 text-sm text-expense">{state.error}</p>}
      {state.answer && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-4 text-sm text-ink">{state.answer}</p>}
    </Card>
  );
}
