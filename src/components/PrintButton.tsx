"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Printer } from "lucide-react";
import * as api from "@/lib/api-client";
import type { PrintLine } from "@/lib/printouts";
import { useStore } from "@/lib/store";

/**
 * Print a list to tick off on paper. The list is saved as printed (so it can
 * be ticked back in from its QR code), then the paper page opens and asks
 * the browser to print.
 */
export function usePrint() {
  const { me, toast } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function print(title: string, lines: PrintLine[]) {
    if (!lines.length) return toast({ message: "Nothing left to print here" });
    setBusy(true);
    try {
      const id = await api.createPrintOut({ title, createdBy: me, lines });
      router.push(`/print/${id}?auto=1`);
    } catch (err) {
      setBusy(false);
      toast({ message: err instanceof Error ? err.message : "Couldn't print that", tone: "error" });
    }
  }
  return { print, busy };
}

export function PrintButton({
  title,
  lines,
  label = "Print",
  before,
  className,
}: {
  title: string;
  /** Worked out on the tap, from what's showing then. */
  lines: () => PrintLine[];
  label?: string;
  /** Runs first, e.g. saving an open sheet before the page changes. */
  before?: () => unknown;
  className?: string;
}) {
  const { print, busy } = usePrint();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const list = lines();
        await before?.();
        print(title, list);
      }}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-supporting font-semibold text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50",
        className,
      )}
    >
      <Printer size={16} aria-hidden="true" /> {busy ? "Opening…" : label}
    </button>
  );
}
