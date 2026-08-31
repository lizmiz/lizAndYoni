"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "./context";
import { QuickAddForm } from "./form";

export function QuickAddDialog() {
  const { isOpen, close } = useQuickAdd();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספה מהירה</DialogTitle>
        </DialogHeader>
        <QuickAddForm onDone={close} />
      </DialogContent>
    </Dialog>
  );
}
