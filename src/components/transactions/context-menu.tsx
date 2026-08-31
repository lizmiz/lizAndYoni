"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { useTransition, type ReactNode } from "react";
import { recategorizeTransaction } from "@/lib/actions/transactions";
import { useToast } from "@/components/toast/context";
import { Tag } from "lucide-react";

type CategoryOption = { id: string; name: string; icon: string | null; parentName?: string };

export function TransactionContextMenu({
  transactionId,
  categories,
  children,
}: {
  transactionId: string;
  categories: CategoryOption[];
  children: ReactNode;
}) {
  const showToast = useToast();
  const [isPending, startTransition] = useTransition();

  function pick(categoryId: string, categoryName: string) {
    startTransition(async () => {
      const result = await recategorizeTransaction(transactionId, categoryId);
      if (result.ok) {
        showToast(
          result.backfilled > 0
            ? `שויך ל-${categoryName} בהצלחה ✓ (וגם ${result.backfilled} תנועות דומות)`
            : `שויך ל-${categoryName} בהצלחה ✓`
        );
      } else {
        showToast("השיוך נכשל, נסו שוב", "error");
      }
    });
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className={isPending ? "opacity-50" : undefined}>{children}</div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 max-h-80 w-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-ink-faint">
            <Tag className="h-3.5 w-3.5" />
            שיוך לקטגוריה
          </div>
          {categories.map((c) => (
            <ContextMenu.Item
              key={c.id}
              onSelect={() => pick(c.id, c.name)}
              className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-surface-2"
            >
              {c.icon} {c.parentName ? `${c.parentName} · ` : ""}
              {c.name}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
