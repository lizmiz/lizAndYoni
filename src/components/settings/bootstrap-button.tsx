"use client";

import { useActionState } from "react";
import { bootstrapReferenceData } from "@/lib/actions/bootstrap";
import { Button } from "@/components/ui/button";

type State = { ok: boolean; error?: string };

export function BootstrapButton() {
  const [state, formAction, isPending] = useActionState(
    async (): Promise<State> => bootstrapReferenceData(),
    { ok: false }
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <Button type="submit" disabled={isPending}>
          {isPending ? "מאתחל…" : "אתחול נתוני בסיס"}
        </Button>
      </form>
      {state.ok && <p className="text-sm text-income">בוצע! רעננו את הדף כדי לראות את הקטגוריות והחשבונות.</p>}
      {state.error && <p className="text-sm text-ink-faint">{state.error}</p>}
    </div>
  );
}
