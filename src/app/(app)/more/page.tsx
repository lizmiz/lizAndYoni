import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav";
import { Card } from "@/components/ui/card";

export default function MorePage() {
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <div className="mx-auto max-w-lg py-4">
      <h1 className="mb-4 text-xl font-bold text-ink">עוד</h1>
      <div className="flex flex-col gap-2">
        {secondary.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <Icon className="h-5 w-5 text-accent" />
                <span className="font-medium text-ink">{item.label}</span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
