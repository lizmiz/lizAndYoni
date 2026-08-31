import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createCategory, archiveCategory, mergeCategories } from "@/lib/actions/categories";

async function handleCreateCategory(formData: FormData) {
  "use server";
  await createCategory(formData);
}

async function handleMergeCategories(formData: FormData) {
  "use server";
  await mergeCategories(formData);
}

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { isArchived: false },
    include: { _count: { select: { transactions: true } } },
    orderBy: { name: "asc" },
  });

  const parents = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const standalone = parents.filter((p) => childrenOf(p.id).length === 0);
  const withChildren = parents.filter((p) => childrenOf(p.id).length > 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <h1 className="text-xl font-bold text-ink">קטגוריות</h1>

      {withChildren.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="mb-2 font-bold text-ink">
            {p.icon} {p.name}
          </div>
          <div className="flex flex-col divide-y divide-line">
            {childrenOf(p.id).map((c) => (
              <CategoryRow key={c.id} id={c.id} icon={c.icon} name={c.name} count={c._count.transactions} />
            ))}
          </div>
        </Card>
      ))}

      {standalone.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 font-bold text-ink">אחר</div>
          <div className="flex flex-col divide-y divide-line">
            {standalone.map((c) => (
              <CategoryRow key={c.id} id={c.id} icon={c.icon} name={c.name} count={c._count.transactions} />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">+ הוספת קטגוריה</summary>
          <form action={handleCreateCategory} className="mt-3 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                name="icon"
                placeholder="🏷️"
                maxLength={2}
                className="w-16 rounded-xl border border-line bg-surface px-3 py-2 text-center outline-none focus:border-accent"
              />
              <input
                name="name"
                required
                placeholder="שם קטגוריה"
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
              />
            </div>
            <select
              name="parentId"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-accent"
              defaultValue=""
            >
              <option value="">קטגוריית-על (ראשית)</option>
              {withChildren.map((p) => (
                <option key={p.id} value={p.id}>
                  תת-קטגוריה של: {p.icon} {p.name}
                </option>
              ))}
            </select>
            <Button type="submit">הוספה</Button>
          </form>
        </details>
      </Card>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer font-bold text-ink">מיזוג קטגוריות</summary>
          <form action={handleMergeCategories} className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-ink-soft">מיזוג מ־</span>
              <select name="fromId" required className="w-full rounded-xl border border-line bg-surface px-3 py-2">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-ink-soft">אל</span>
              <select name="toId" required className="w-full rounded-xl border border-line bg-surface px-3 py-2">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-faint">
              כל התנועות והספקים שהיו משויכים לקטגוריה הראשונה יעברו לשנייה, והראשונה תיארכב.
            </p>
            <Button type="submit" variant="outline">
              מיזוג
            </Button>
          </form>
        </details>
      </Card>
    </div>
  );
}

function CategoryRow({ id, icon, name, count }: { id: string; icon: string | null; name: string; count: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link href={`/transactions?category=${id}&view=expense`} className="flex flex-1 items-center gap-2 text-sm text-ink hover:text-accent">
        <span>{icon}</span>
        <span>{name}</span>
        <span className="text-ink-faint">({count})</span>
      </Link>
      <form action={archiveCategory.bind(null, id)}>
        <button type="submit" className="text-xs text-ink-faint hover:text-expense">
          ארכוב
        </button>
      </form>
    </div>
  );
}
