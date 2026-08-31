"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const bankSchema = z.object({
  name: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  last4: z.string().trim().optional(),
  currentBalance: z.coerce.number().optional(),
});

export async function createBankAccount(formData: FormData) {
  const parsed = bankSchema.safeParse({
    name: formData.get("name"),
    bankName: formData.get("bankName"),
    last4: formData.get("last4"),
    currentBalance: formData.get("currentBalance") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "יש למלא שם וחשבון" };

  await prisma.bankAccount.create({
    data: {
      name: parsed.data.name,
      bankName: parsed.data.bankName,
      last4: parsed.data.last4 || undefined,
      currentBalance: parsed.data.currentBalance ?? undefined,
      balanceAsOf: parsed.data.currentBalance !== undefined ? new Date() : undefined,
    },
  });

  revalidatePath("/accounts");
  return { ok: true as const };
}

export async function updateBankBalance(formData: FormData) {
  const id = formData.get("id") as string;
  const balance = Number(formData.get("currentBalance"));
  if (!id || Number.isNaN(balance)) return { ok: false as const, error: "סכום לא תקין" };

  await prisma.bankAccount.update({
    where: { id },
    data: { currentBalance: balance, balanceAsOf: new Date() },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true as const };
}

const cardSchema = z.object({
  name: z.string().trim().min(1),
  network: z.string().trim().optional(),
  last4: z.string().trim().min(1),
  bankAccountId: z.string().min(1),
});

export async function createCreditCard(formData: FormData) {
  const parsed = cardSchema.safeParse({
    name: formData.get("name"),
    network: formData.get("network"),
    last4: formData.get("last4"),
    bankAccountId: formData.get("bankAccountId"),
  });
  if (!parsed.success) return { ok: false as const, error: "יש למלא את כל השדות" };

  await prisma.creditCard.create({
    data: {
      name: parsed.data.name,
      network: parsed.data.network || undefined,
      last4: parsed.data.last4,
      bankAccountId: parsed.data.bankAccountId,
    },
  });

  revalidatePath("/accounts");
  return { ok: true as const };
}
