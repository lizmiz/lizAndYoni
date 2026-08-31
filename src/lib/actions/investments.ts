"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1),
  ownerUserId: z.string().optional(),
  provider: z.string().trim().min(1),
  productType: z.string().trim().min(1),
  track: z.string().trim().optional(),
  monthlyDeposit: z.coerce.number().optional(),
  balance: z.coerce.number(),
  managementFee: z.coerce.number().optional(),
  returnRate: z.coerce.number().optional(),
  notes: z.string().trim().optional(),
});

export async function createInvestment(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "יש למלא את השדות הנדרשים" };

  await prisma.investmentAccount.create({
    data: {
      name: parsed.data.name,
      ownerUserId: parsed.data.ownerUserId || undefined,
      provider: parsed.data.provider,
      productType: parsed.data.productType,
      track: parsed.data.track || undefined,
      monthlyDeposit: parsed.data.monthlyDeposit || undefined,
      balance: parsed.data.balance,
      managementFee: parsed.data.managementFee || undefined,
      returnRate: parsed.data.returnRate || undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  revalidatePath("/investments");
  return { ok: true as const };
}

export async function deleteInvestment(id: string) {
  await prisma.investmentAccount.delete({ where: { id } });
  revalidatePath("/investments");
}
