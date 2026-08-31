"use server";

import { buildFinancialContext } from "@/lib/queries/ai-context";
import { askClaude, getClaudeClient } from "@/lib/ai/claude";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ScopeKeyParam } from "@/lib/nav";

const INSIGHTS_SYSTEM = `אתה עוזר פיננסי למערכת ניהול פיננסים משפחתית ישראלית בשם "מצפן פיננסי משפחתי".
תקבל נתונים פיננסיים אמיתיים בפורמט JSON (הכנסות, הוצאות, חיסכון, לפי חודש ולפי קטגוריה, בשקלים).
המשימה שלך: לזהות 3-5 תובנות קצרות, ספציפיות ומבוססות-נתונים בעברית — בדיוק כמו אנליסט פיננסי אישי.
כללים:
- כל תובנה חייבת להתבסס על מספרים אמיתיים מהנתונים, לא כלליים.
- משפט אחד לכל תובנה, קצר וברור, בלי ז'רגון חשבונאי.
- התמקד בחריגות, מגמות, ודברים שכדאי לשים לב אליהם.
- השב אך ורק ברשימת שורות, שורה אחת לכל תובנה, בלי מספור ובלי כוכביות.`;

export async function generateAiInsights(scopeParam: ScopeKeyParam | undefined) {
  if (!getClaudeClient()) return { ok: false as const, reason: "no-key" as const };

  const context = await buildFinancialContext(scopeParam, 6);
  const response = await askClaude(INSIGHTS_SYSTEM, JSON.stringify(context));
  if (!response) return { ok: false as const, reason: "error" as const };

  const lines = response
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return { ok: true as const, insights: lines };
}

const QA_SYSTEM = `אתה עוזר פיננסי למערכת ניהול פיננסים משפחתית ישראלית בשם "מצפן פיננסי משפחתי".
תקבל נתונים פיננסיים אמיתיים בפורמט JSON (הכנסות, הוצאות, חיסכון, לפי חודש ולפי קטגוריה, בשקלים) ושאלה של המשתמש בעברית.
ענה על השאלה אך ורק על סמך הנתונים שסופקו. אם הנתונים לא מספיקים כדי לענות, אמור זאת בפירוש.
תשובה קצרה, ברורה, בעברית, עם מספרים קונקרטיים.`;

export async function askFinancialQuestion(formData: FormData) {
  const question = String(formData.get("question") ?? "").trim();
  const scope = (formData.get("scope") as string) || undefined;
  if (!question) return { ok: false as const, error: "יש להקליד שאלה" };

  if (!getClaudeClient()) {
    return { ok: false as const, error: "מפתח Claude API לא הוגדר עדיין — אפשר להוסיף אותו בהגדרות השרת." };
  }

  const context = await buildFinancialContext(scope as ScopeKeyParam | undefined, 6);
  const prompt = `נתונים:\n${JSON.stringify(context)}\n\nשאלה: ${question}`;
  const answer = await askClaude(QA_SYSTEM, prompt);

  if (!answer) return { ok: false as const, error: "לא הצלחתי לקבל תשובה כרגע. נסו שוב." };
  return { ok: true as const, answer };
}

export async function dismissInsight(id: string) {
  await prisma.insight.update({ where: { id }, data: { isDismissed: true } });
  revalidatePath("/insights");
}
