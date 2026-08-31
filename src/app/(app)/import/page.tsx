import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ImportUploadForm } from "@/components/import/upload-form";

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
    </div>
  );
}
