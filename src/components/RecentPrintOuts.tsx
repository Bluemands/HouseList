"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ChevronRight, Printer } from "lucide-react";
import * as api from "@/lib/api-client";
import type { PrintOutSummary } from "@/lib/printouts";
import { describeDay, toDayString } from "@/lib/format";

/** Opens a print-out to tick back in; provided by the app shell. */
export const TickBackContext = createContext<(id: string) => void>(() => {});
export const useTickBack = () => useContext(TickBackContext);

// Print-outs thrown away but still in their undo window, kept off the list.
const hidden = new Set<string>();
const HIDDEN_EVENT = "printouts-hidden";

/** Takes a print-out off (or puts it back on) every list on this phone. */
export function hidePrintOut(id: string, hide: boolean) {
  if (hide) hidden.add(id);
  else hidden.delete(id);
  window.dispatchEvent(new Event(HIDDEN_EVENT));
}

/**
 * The last few print-outs, to pick the one in your hand and tick it back in
 * (the QR code on the paper does the same). Nothing shows until there's one.
 */
export function RecentPrintOuts({ limit = 3 }: { limit?: number }) {
  const open = useTickBack();
  const [printOuts, setPrintOuts] = useState<PrintOutSummary[]>([]);
  const [, setHiddenSeq] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .listPrintOuts()
        .then((list) => live && setPrintOuts(list))
        .catch(() => {});
    load();
    // Back from printing (or from the other phone's), the list is fresh.
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    const onHidden = () => setHiddenSeq((n) => n + 1);
    window.addEventListener(HIDDEN_EVENT, onHidden);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener(HIDDEN_EVENT, onHidden);
    };
  }, []);

  const shown = printOuts.filter((p) => !hidden.has(p.id));
  if (!shown.length) return null;

  return (
    <section aria-labelledby="printouts-head">
      <h2 id="printouts-head" className="px-1 pb-1.5 text-supporting font-bold text-ink">
        Print-outs
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {shown.slice(0, limit).map((p) => (
          <li key={p.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => open(p.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/60"
            >
              <Printer size={17} className="shrink-0 text-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-ink">{p.title}</span>
                <span className="block text-meta text-ink-2">
                  Printed {describeDay(toDayString(new Date(p.createdAt)))} by {p.createdBy}
                </span>
              </span>
              <span className="shrink-0 text-supporting font-semibold text-accent-text">Tick off</span>
              <ChevronRight size={16} className="-ml-2 shrink-0 text-accent-text" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
