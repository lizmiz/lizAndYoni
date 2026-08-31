import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatILS, formatDateIL } from "@/lib/utils";
import { TransactionEditForm } from "@/components/transactions/edit-form";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [transaction, categories] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: { scope: true, vendor: true, bankAccount: true, creditCard: true, category: true },
    }),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } }),
  ]);

  if (!transaction) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-4">
      <Card className="p-5">
        <div className="text-xs text-ink-faint">{formatDateIL(transaction.transactionDate)}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-ink">
          {transaction.direction === "EXPENSE" ? "-" : "+"}
          {formatILS(Number(transaction.amount))}
        </div>
        <div className="mt-1 text-ink-soft">{transaction.vendor?.name ?? transaction.description}</div>

        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-faint">שיוך</dt>
          <dd className="text-ink">
            {transaction.scope.icon} {transaction.scope.name}
          </dd>
          <dt className="text-ink-faint">חשבון</dt>
          <dd className="text-ink">{transaction.bankAccount?.name ?? transaction.creditCard?.name ?? "—"}</dd>
          {transaction.notes && (
            <>
              <dt className="text-ink-faint">הערה</dt>
              <dd className="text-ink">{transaction.notes}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold text-ink">סיווג</h2>
        <TransactionEditForm
          transactionId={transaction.id}
          categories={categories}
          currentCategoryId={transaction.categoryId ?? ""}
          currentEffect={transaction.economicEffect}
          currentNotes={transaction.notes ?? ""}
        />
      </Card>
    </div>
  );
}
