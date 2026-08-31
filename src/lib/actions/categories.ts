"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1),
  icon: z.string().trim().optional(),
  parentId: z.string().optional(),
});

export async function createCategory(formData: FormData) {
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon"),
    parentId: formData.get("parentId") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: "שם קטגוריה חסר" };

  await prisma.category.create({
    data: {
      name: parsed.data.name,
      icon: parsed.data.icon || "🏷️",
      parentId: parsed.data.parentId || undefined,
    },
  });

  revalidatePath("/categories");
  return { ok: true as const };
}

export async function archiveCategory(id: string) {
  await prisma.category.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/categories");
}

export async function mergeCategories(formData: FormData) {
  const fromId = formData.get("fromId") as string;
  const toId = formData.get("toId") as string;
  if (!fromId || !toId || fromId === toId) {
    return { ok: false as const, error: "יש לבחור שתי קטגוריות שונות" };
  }

  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { categoryId: fromId }, data: { categoryId: toId } }),
    prisma.vendor.updateMany({ where: { defaultCategoryId: fromId }, data: { defaultCategoryId: toId } }),
    prisma.recurringDefinition.updateMany({ where: { categoryId: fromId }, data: { categoryId: toId } }),
    prisma.category.update({ where: { id: fromId }, data: { isArchived: true } }),
  ]);

  revalidatePath("/categories");
  return { ok: true as const };
}
