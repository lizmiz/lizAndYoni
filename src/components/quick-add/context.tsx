"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ReferenceData } from "@/lib/queries/reference";

type QuickAddContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  referenceData: ReferenceData;
};

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function QuickAddProvider({
  children,
  referenceData,
}: {
  children: ReactNode;
  referenceData: ReferenceData;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <QuickAddContext.Provider value={{ isOpen, open, close, referenceData }}>
      {children}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}
