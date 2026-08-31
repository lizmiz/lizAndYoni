import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatILS, formatDateIL } from "@/lib/utils";
import { createInsurancePolicy, deleteInsurancePolicy } from "@/lib/actions/insurance";
import { AlertTriangle } from "lucide-react";

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: "שבועי",
  MONTHLY: "חודשי",
  QUARTERLY: "רבעוני",
  ANNUAL: "שנתי",
};

async function handleCreate(formData: FormData) {
  "use server";
  await createInsurancePolicy(formData);
}

export default async function InsurancePage() {
  const [policies, users] = await Promise.all([
    prisma.insurancePolicy.findMany({ include: { insuredUser: true }, orderBy: { renewalDate: "asc" } }),
    prisma.user.findMany(),
  ]);

  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">ביטוחים</h1>

      <div className="flex flex-col gap-3">
        {policies.map((p) => {
          const renewingSoon = p.renewalDate && p.renewalDate <= in30Days;
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-ink">
                    {p.company} · {p.type}
                  </div>
                  <div className="text-xs text-ink-faint">
                    {p.insuredUser?.name ?? ""} {p.policyNumber ? `· פוליסה ${p.policyNumber}` : ""}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold tabular-nums text-ink">{formatILS(Number(p.cost))}</div>
                  <div className="text-xs text-ink-faint">{FREQ_LABEL[p.paymentFrequency]}</div>
                </div>
              </div>
              {p.renewalDate && (
                <div className={`mt-2 flex items-center gap-1.5 text-xs ${renewingSoon ? "text-gold" : "text-ink-faint"}`}>
                  {renewingSoon && <AlertTriangle className="h-3.5 w-3.5" />}
                  חידוש: {formatDateIL(p.renewalDate)}
                </div>
              )}
              <form action={deleteInsurancePolicy.bind(null, p.id)} className="mt-2">
                <button type="submit" className="text-xs text-ink-faint hover:text-expense">
                  מחיקה
                </button>
              </form>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת פוליסת ביטוח</summary>
          <form action={handleCreate} className="mt-3 flex flex-col gap-3">
            <select name="insuredUserId" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
              <option value="">מבוטח (לא חובה)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input name="company" required placeholder="חברת ביטוח" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="type" required placeholder="סוג (בריאות/רכב/דירה...)" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <div className="flex gap-2">
              <input name="cost" type="number" step="0.01" required placeholder="עלות" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <select name="paymentFrequency" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent">
                <option value="MONTHLY">חודשי</option>
                <option value="QUARTERLY">רבעוני</option>
                <option value="ANNUAL">שנתי</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input name="renewalDate" type="date" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
              <input name="policyNumber" placeholder="מספר פוליסה" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </div>
            <input name="notes" placeholder="הערות" className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
