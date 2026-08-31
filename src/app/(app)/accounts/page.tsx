import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatILS, formatDateIL } from "@/lib/utils";
import { createBankAccount, updateBankBalance, createCreditCard } from "@/lib/actions/accounts";
import Link from "next/link";
import { CreditCard as CardIcon } from "lucide-react";

async function handleUpdateBalance(formData: FormData) {
  "use server";
  await updateBankBalance(formData);
}

async function handleCreateBankAccount(formData: FormData) {
  "use server";
  await createBankAccount(formData);
}

async function handleCreateCreditCard(formData: FormData) {
  "use server";
  await createCreditCard(formData);
}

export default async function AccountsPage() {
  const [bankAccounts, creditCards] = await Promise.all([
    prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.creditCard.findMany({ where: { isActive: true }, include: { bankAccount: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">חשבונות בנק וכרטיסי אשראי</h1>

      <div className="flex flex-col gap-3">
        {bankAccounts.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-ink">{a.name}</div>
                <div className="text-xs text-ink-faint">
                  {a.bankName} {a.last4 ? `· •••${a.last4}` : ""}
                </div>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold tabular-nums text-ink">{formatILS(Number(a.currentBalance ?? 0))}</div>
                {a.balanceAsOf && (
                  <div className="text-[11px] text-ink-faint">נכון ל-{formatDateIL(a.balanceAsOf)}</div>
                )}
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-accent">עדכון יתרה</summary>
              <form action={handleUpdateBalance} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input
                  name="currentBalance"
                  type="number"
                  step="0.01"
                  defaultValue={Number(a.currentBalance ?? 0)}
                  className="flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
                />
                <Button type="submit" size="sm">
                  עדכון
                </Button>
              </form>
            </details>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת חשבון בנק</summary>
          <form action={handleCreateBankAccount} className="mt-3 flex flex-col gap-3">
            <input name="name" required placeholder="שם החשבון" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <input name="bankName" required placeholder="שם הבנק" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <input name="last4" placeholder="4 ספרות אחרונות" maxLength={4} className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <input name="currentBalance" type="number" step="0.01" placeholder="יתרה נוכחית" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>

      <h2 className="mt-2 text-lg font-bold text-ink">כרטיסי אשראי</h2>
      <div className="flex flex-col gap-3">
        {creditCards.map((c) => (
          <Link key={c.id} href={`/accounts/cards/${c.id}`}>
            <Card className="flex items-center gap-3 p-4 hover:bg-surface-2">
              <CardIcon className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <div className="font-bold text-ink">{c.name}</div>
                <div className="text-xs text-ink-faint">
                  {c.network ?? ""} •••{c.last4} · חיוב מ{c.bankAccount.name}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת כרטיס אשראי</summary>
          <form action={handleCreateCreditCard} className="mt-3 flex flex-col gap-3">
            <input name="name" required placeholder="שם הכרטיס" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <input name="network" placeholder="חברת אשראי (MAX / CAL / Isracard)" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <input name="last4" required maxLength={4} placeholder="4 ספרות אחרונות" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <select name="bankAccountId" required className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  חיוב מ־{a.name}
                </option>
              ))}
            </select>
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
