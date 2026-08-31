import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatILS } from "@/lib/utils";
import { createInvestment, deleteInvestment } from "@/lib/actions/investments";

async function handleCreate(formData: FormData) {
  "use server";
  await createInvestment(formData);
}

export default async function InvestmentsPage() {
  const [investments, users] = await Promise.all([
    prisma.investmentAccount.findMany({ include: { ownerUser: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany(),
  ]);

  const totalBalance = investments.reduce((s, i) => s + Number(i.balance), 0);
  const totalMonthly = investments.reduce((s, i) => s + Number(i.monthlyDeposit ?? 0), 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">השקעות וחסכונות</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-ink-faint">סך היתרות</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-accent">{formatILS(totalBalance)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-ink-faint">הפקדה חודשית כוללת</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-ink">{formatILS(totalMonthly)}</div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        {investments.map((inv) => (
          <Card key={inv.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-ink">{inv.name}</div>
                <div className="text-xs text-ink-faint">
                  {inv.provider} · {inv.productType}
                  {inv.track ? ` · ${inv.track}` : ""}
                  {inv.ownerUser ? ` · ${inv.ownerUser.name}` : ""}
                </div>
              </div>
              <div className="text-left">
                <div className="font-bold tabular-nums text-ink">{formatILS(Number(inv.balance))}</div>
                {inv.monthlyDeposit && (
                  <div className="text-xs text-ink-faint">{formatILS(Number(inv.monthlyDeposit))} / חודש</div>
                )}
              </div>
            </div>
            {(inv.managementFee || inv.returnRate) && (
              <div className="mt-2 flex gap-4 text-xs text-ink-faint">
                {inv.managementFee && <span>דמי ניהול: {Number(inv.managementFee)}%</span>}
                {inv.returnRate && <span>תשואה: {Number(inv.returnRate)}%</span>}
              </div>
            )}
            <form action={deleteInvestment.bind(null, inv.id)} className="mt-2">
              <button type="submit" className="text-xs text-ink-faint hover:text-expense">
                מחיקה
              </button>
            </form>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת מוצר חיסכון/השקעה</summary>
          <form action={handleCreate} className="mt-3 flex flex-col gap-3">
            <input name="name" required placeholder="שם (למשל: פנסיה מנורה)" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <select name="ownerUserId" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              <option value="">בעלים (לא חובה)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input name="provider" required placeholder="גוף מנהל" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="productType" required placeholder="סוג מוצר" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <input name="track" placeholder="מסלול (לא חובה)" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <div className="flex gap-2">
              <input name="balance" type="number" step="0.01" required placeholder="יתרה נוכחית" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="monthlyDeposit" type="number" step="0.01" placeholder="הפקדה חודשית" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <div className="flex gap-2">
              <input name="managementFee" type="number" step="0.01" placeholder="דמי ניהול %" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="returnRate" type="number" step="0.01" placeholder="תשואה %" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <input name="notes" placeholder="הערות" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
