"use client";

import { useState } from "react";
import { useSheetExit } from "@/lib/useSheetDrag";
import { SimpleHome } from "@/components/simple/SimpleHome";
import { GuidedAdd } from "@/components/simple/GuidedAdd";
import { SimpleItemSheet } from "@/components/simple/SimpleItemSheet";

/** The simple checklist layout. Loaded on its own, so the full app's code stays off a simple phone. */
export function SimpleLayout({ onSettings }: { onSettings: () => void }) {
  const [adding, setAdding] = useState(false);
  const addSheet = useSheetExit(adding || null);

  return (
    <>
      <main className="mx-auto w-full max-w-[640px] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+112px)] sm:px-6 lg:pt-10">
        <SimpleHome onAdd={() => setAdding(true)} onSettings={onSettings} />
      </main>
      {addSheet.shown && (
        <GuidedAdd key={addSheet.opening} leaving={addSheet.leaving} onClose={() => setAdding(false)} />
      )}
      <SimpleItemSheet />
    </>
  );
}
