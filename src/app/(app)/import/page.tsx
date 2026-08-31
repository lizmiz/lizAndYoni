import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ImportUploadForm } from "@/components/import/upload-form";
import { HistoryUploadForm } from "@/components/import/history-upload-form";

export default async function ImportPage() {
  const creditCards = await prisma.creditCard.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">ייבוא נתונים</h1>

      <Card className="p-5">
        <h2 className="mb-2 font-bold text-ink">פירוט עסקאות אשראי</h2>
        <p className="mb-4 text-sm text-ink-soft">
          קובץ ה-Excel שחברת האשראי (למשל MAX) שולחת מדי חודש. המערכת מזהה אוטומטית את הכרטיס לפי 4 הספרות
          האחרונות, לומדת ספקים חדשים, ומעדכנת את סטטוס ההתאמה מול החיוב.
        </p>
        <ImportUploadForm creditCards={creditCards} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 font-bold text-ink">היסטוריה מהגיליון הישן</h2>
        <p className="mb-4 text-sm text-ink-soft">
          ייצוא Excel של הגיליון &quot;הוצאות הכל ונכסים&quot; (File → Download → Microsoft Excel בגוגל שיטס).
          מייבא את ההכנסות וההוצאות האמיתיות מ-21 החודשים האחרונים בפורמט העקבי בגיליון. חודשים ישנים יותר
          בפורמט שונה, ותנועות מעבר-כספים-ללקוח (שממילא מתקזזות) לא מיובאות — ראו את הפירוט אחרי הייבוא.
        </p>
        <HistoryUploadForm />
      </Card>
    </div>
  );
}
