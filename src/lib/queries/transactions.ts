import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import type { ScopeKeyParam } from "@/lib/nav";
import { resolveScopeIds } from "@/lib/queries/dashboard";

export async function listTransactions(params: {
  scope: ScopeKeyParam | undefined;
  monthDate: Date;
  categoryId?: string;
  accountKey?: string; // "bank:<id>" | "card:<id>"
}) {
  const { scopeIds } = await resolveScopeIds(params.scope);
  const [accountType, accountId] = params.accountKey?.split(":") ?? [];

  const transactions = await prisma.transaction.findMany({
    where: {
      scopeId: { in: scopeIds },
      transactionDate: { gte: startOfMonth(params.monthDate), lte: endOfMonth(params.monthDate) },
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(accountType === "bank" ? { bankAccountId: accountId } : {}),
      ...(accountType === "card" ? { creditCardId: accountId } : {}),
    },
    include: {
      category: true,
      scope: true,
      vendor: true,
      bankAccount: true,
      creditCard: true,
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  });

  return transactions;
}
