import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const STATUS_META = {
  MATCHED: { label: "מותאם", icon: CheckCircle2, className: "text-income" },
  PARTIAL: { label: "דורש בדיקה", icon: AlertTriangle, className: "text-gold" },
  UNMATCHED: { label: "לא מותאם", icon: XCircle, className: "text-expense" },
} as const;

export default async function CardReconciliationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const card = await prisma.creditCard.findUnique({
    where: { id },
    include: { bankAccount: true, statements: { orderBy: { period: "desc" } } },
  });
  if (!card) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-ink">{card.name}</h1>
        <p className="text-sm text-ink-faint">
          {card.network} •••{card.last4} · חיוב מ{card.bankAccount.name}
        </p>
      </div>

      {card.statements.length === 0 ? (
        <Card className="p-8 text-center text-ink-faint">
          עדיין אין חיובים מיובאים לכרטיס הזה.{" "}
          <Link href="/import" className="text-accent">
            ייבוא פירוט עסקאות ←
          </Link>
        </Card>
      ) : (
        card.statements.map((s) => {
          const meta = STATUS_META[s.status];
          const Icon = meta.icon;
          const diff = Number(s.billedAmount) - Number(s.matchedAmount);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${meta.className}`} />
                  <span className={`font-bold ${meta.className}`}>{meta.label}</span>
                </div>
                <span className="text-sm text-ink-faint">{s.period}</span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-ink-faint">חיוב חודשי</dt>
                <dd className="text-ink">{formatILS(Number(s.billedAmount))}</dd>
                <dt className="text-ink-faint">עסקאות שנמצאו</dt>
                <dd className="text-ink">{s.transactionsCount}</dd>
                <dt className="text-ink-faint">דורשות סיווג</dt>
                <dd className="text-ink">{s.uncategorizedCount}</dd>
                <dt className="text-ink-faint">הפרש</dt>
                <dd className="text-ink">{formatILS(Math.abs(diff))}</dd>
              </dl>

              <Link
                href={`/transactions?account=card:${card.id}&view=expense`}
                className="mt-3 inline-block text-sm font-semibold text-accent"
              >
                כל עסקאות הכרטיס ←
              </Link>
            </Card>
          );
        })
      )}
    </div>
  );
}
