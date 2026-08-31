"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  insuredUserId: z.string().optional(),
  company: z.string().trim().min(1),
  type: z.string().trim().min(1),
  cost: z.coerce.number().positive(),
  paymentFrequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]),
  renewalDate: z.string().optional(),
  policyNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createInsurancePolicy(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "יש למלא את השדות הנדרשים" };

  await prisma.insurancePolicy.create({
    data: {
      insuredUserId: parsed.data.insuredUserId || undefined,
      company: parsed.data.company,
      type: parsed.data.type,
      cost: parsed.data.cost,
      paymentFrequency: parsed.data.paymentFrequency,
      renewalDate: parsed.data.renewalDate ? new Date(parsed.data.renewalDate) : undefined,
      policyNumber: parsed.data.policyNumber || undefined,
      notes: parsed.data.notes || undefined,
    },
  });

  revalidatePath("/insurance");
  return { ok: true as const };
}

export async function deleteInsurancePolicy(id: string) {
  await prisma.insurancePolicy.delete({ where: { id } });
  revalidatePath("/insurance");
}
