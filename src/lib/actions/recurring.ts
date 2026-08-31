"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  direction: z.enum(["INCOME", "EXPENSE"]),
  expectedDay: z.coerce.number().min(1).max(31),
  scopeId: z.string().min(1),
  categoryId: z.string().optional(),
  bankAccountId: z.string().optional(),
});

export async function createRecurring(formData: FormData) {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    direction: formData.get("direction"),
    expectedDay: formData.get("expectedDay"),
    scopeId: formData.get("scopeId"),
    categoryId: formData.get("categoryId") || undefined,
    bankAccountId: formData.get("bankAccountId") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "יש למלא את כל השדות הנדרשים" };

  await prisma.recurringDefinition.create({
    data: {
      name: parsed.data.name,
      amount: parsed.data.amount,
      direction: parsed.data.direction,
      expectedDay: parsed.data.expectedDay,
      scopeId: parsed.data.scopeId,
      categoryId: parsed.data.categoryId || undefined,
      bankAccountId: parsed.data.bankAccountId || undefined,
    },
  });

  revalidatePath("/recurring");
  revalidatePath("/");
  return { ok: true as const };
}

export async function toggleRecurringActive(id: string, isActive: boolean) {
  await prisma.recurringDefinition.update({ where: { id }, data: { isActive } });
  revalidatePath("/recurring");
  revalidatePath("/");
}

export async function markRecurringReceived(id: string) {
  const def = await prisma.recurringDefinition.findUniqueOrThrow({ where: { id } });
  const now = new Date();

  await prisma.transaction.create({
    data: {
      transactionDate: now,
      amount: def.amount,
      direction: def.direction,
      economicEffect: def.direction === "INCOME" ? "REAL_INCOME" : "REAL_EXPENSE",
      status: "ACTUAL",
      scopeId: def.scopeId,
      categoryId: def.categoryId ?? undefined,
      bankAccountId: def.bankAccountId ?? undefined,
      description: def.name,
      isRecurring: true,
      recurringDefinitionId: def.id,
      source: "MANUAL",
    },
  });

  revalidatePath("/recurring");
  revalidatePath("/");
  revalidatePath("/transactions");
}
