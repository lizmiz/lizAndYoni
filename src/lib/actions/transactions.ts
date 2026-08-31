"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const quickAddSchema = z.object({
  direction: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().min(1),
  scopeId: z.string().min(1),
  categoryId: z.string().min(1),
  accountKey: z.string().min(1), // "bank:<id>" or "card:<id>"
  vendorName: z.string().trim().min(1),
  notes: z.string().trim().optional(),
});

function normalizeVendorName(name: string) {
  return name.toLowerCase().replace(/\s+/g, "");
}

export async function createQuickTransaction(formData: FormData) {
  const parsed = quickAddSchema.safeParse({
    direction: formData.get("direction"),
    amount: formData.get("amount"),
    transactionDate: formData.get("transactionDate"),
    scopeId: formData.get("scopeId"),
    categoryId: formData.get("categoryId"),
    accountKey: formData.get("accountKey"),
    vendorName: formData.get("vendorName"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "שגיאה בטופס" };
  }

  const data = parsed.data;
  const [accountType, accountId] = data.accountKey.split(":");

  // ── Vendor learning: find-or-create by normalized name, keep default classification in sync ──
  const normalizedName = normalizeVendorName(data.vendorName);
  const vendor = await prisma.vendor.upsert({
    where: { normalizedName },
    update: {
      defaultCategoryId: data.categoryId,
      defaultScopeId: data.scopeId,
      isLearned: true,
    },
    create: {
      name: data.vendorName,
      normalizedName,
      defaultCategoryId: data.categoryId,
      defaultScopeId: data.scopeId,
      isLearned: true,
    },
  });

  await prisma.transaction.create({
    data: {
      transactionDate: new Date(data.transactionDate),
      amount: data.amount,
      direction: data.direction,
      economicEffect: data.direction === "INCOME" ? "REAL_INCOME" : "REAL_EXPENSE",
      status: "ACTUAL",
      scopeId: data.scopeId,
      categoryId: data.categoryId,
      vendorId: vendor.id,
      bankAccountId: accountType === "bank" ? accountId : undefined,
      creditCardId: accountType === "card" ? accountId : undefined,
      description: data.vendorName,
      notes: data.notes || undefined,
      source: "MANUAL",
    },
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  return { ok: true as const };
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/transactions");
}

/**
 * Quick recategorize (right-click on a transaction row). Beyond updating the one
 * transaction, this teaches the vendor's default category going forward AND backfills
 * every other still-uncategorized transaction from the same vendor — past and future
 * imports both benefit, matching how vendor learning already works for quick-add.
 * Never touches a transaction that already has a different category someone chose on
 * purpose.
 */
export async function recategorizeTransaction(transactionId: string, categoryId: string) {
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });

  await prisma.transaction.update({ where: { id: transactionId }, data: { categoryId } });

  let backfilled = 0;
  if (tx.vendorId) {
    await prisma.vendor.update({ where: { id: tx.vendorId }, data: { defaultCategoryId: categoryId, isLearned: true } });
    const result = await prisma.transaction.updateMany({
      where: { vendorId: tx.vendorId, categoryId: null, id: { not: transactionId } },
      data: { categoryId },
    });
    backfilled = result.count;
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  return { ok: true as const, backfilled };
}

const updateSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  economicEffect: z.enum([
    "REAL_INCOME",
    "REAL_EXPENSE",
    "SAVINGS_INVESTMENT",
    "ACCOUNT_TRANSFER",
    "REFUND",
    "CLIENT_EXPENSE",
    "CLIENT_REIMBURSEMENT",
    "TAX",
    "OTHER",
  ]),
  notes: z.string().trim().optional(),
});

export async function updateTransaction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId"),
    economicEffect: formData.get("economicEffect"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message };

  const tx = await prisma.transaction.update({
    where: { id: parsed.data.id },
    data: {
      categoryId: parsed.data.categoryId,
      economicEffect: parsed.data.economicEffect,
      notes: parsed.data.notes || undefined,
    },
  });

  // Keep vendor learning in sync with corrections.
  if (tx.vendorId) {
    await prisma.vendor.update({
      where: { id: tx.vendorId },
      data: { defaultCategoryId: parsed.data.categoryId },
    });
  }

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath(`/transactions/${parsed.data.id}`);
  return { ok: true as const };
}
