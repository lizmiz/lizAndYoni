"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seedReferenceData } from "@/lib/seed/reference-data";
import { revalidatePath } from "next/cache";

/**
 * One-time production bootstrap: seeds scopes/accounts/categories/vendors/recurring
 * definitions from inside the app itself, using the app's own DB connection — so it
 * works regardless of where the database is hosted. Idempotent and requires a signed-in
 * (allowlisted) user, since middleware already restricts who reaches this page.
 */
export async function bootstrapReferenceData() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "יש להתחבר קודם" };

  const result = await seedReferenceData(prisma);
  revalidatePath("/");
  revalidatePath("/settings");

  if (!result.ok) return { ok: false as const, error: "הנתונים כבר אותחלו קודם — אין צורך להריץ שוב." };
  return { ok: true as const };
}
