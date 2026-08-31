import { prisma } from "@/lib/prisma";

export async function getReferenceData() {
  const [scopes, categories, vendors, bankAccounts, creditCards] = await Promise.all([
    prisma.financialScope.findMany({ orderBy: { key: "asc" } }),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.creditCard.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  // Prisma's Decimal is a class instance — not a plain object, so it can't cross the
  // server → client component boundary. Convert to a plain number before returning.
  const plainBankAccounts = bankAccounts.map((a) => ({
    ...a,
    currentBalance: a.currentBalance === null ? null : Number(a.currentBalance),
  }));

  return { scopes, categories, vendors, bankAccounts: plainBankAccounts, creditCards };
}

export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
