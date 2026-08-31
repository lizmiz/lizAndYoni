import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { BootstrapButton } from "@/components/settings/bootstrap-button";
import { auth } from "@/auth";

export default async function SettingsPage() {
  const [session, scopeCount, categoryCount, vendorCount] = await Promise.all([
    auth(),
    prisma.financialScope.count(),
    prisma.category.count(),
    prisma.vendor.count(),
  ]);

  const isBootstrapped = scopeCount > 0;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">הגדרות</h1>

      <Card className="p-5">
        <h2 className="mb-2 font-bold text-ink">המשתמש שלך</h2>
        <p className="text-sm text-ink-soft">{session?.user?.name ?? session?.user?.email}</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 font-bold text-ink">נתוני בסיס</h2>
        {isBootstrapped ? (
          <p className="text-sm text-ink-soft">
            המערכת מאותחלת: {scopeCount} שיוכים, {categoryCount} קטגוריות, {vendorCount} ספקים ידועים.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-soft">
              עדיין אין נתוני בסיס (שיוכים, קטגוריות, חשבונות, ספקים מוכרים). לחצו כדי לאתחל את המערכת בפעם
              הראשונה — פעולה חד-פעמית ובטוחה להרצה כפולה.
            </p>
            <BootstrapButton />
          </>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 font-bold text-ink">שיוכים פיננסיים וכללי למידת ספקים</h2>
        <p className="text-sm text-ink-soft">
          ניהול קטגוריות בעמוד <a href="/categories" className="text-accent">קטגוריות</a>, וחשבונות/כרטיסים
          בעמוד <a href="/accounts" className="text-accent">חשבונות</a>.
        </p>
      </Card>
    </div>
  );
}
