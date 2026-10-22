"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Trash2, X } from "lucide-react";
import * as api from "@/lib/api-client";
import { lineLabels, lineState, type PrintOutDTO } from "@/lib/printouts";
import { describeDay, toDayString } from "@/lib/format";
import { UNDO_MS, useStore } from "@/lib/store";
import { hidePrintOut } from "@/components/RecentPrintOuts";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { Button } from "@/components/ui";

/**
 * Ticking a print-out back in: the list as it went on paper, same order and
 * numbers, to tap what was ticked by hand. One "Mark done" finishes them all,
 * with one undo; anything done or deleted since says so instead. A test or
 * stale one can be thrown away without ticking anything.
 */
export function TickBackSheet({ id, leaving, onClose }: { id: string; leaving: boolean; onClose: () => void }) {
  const { itemById, patchItem, toast } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const dragHandlers = useSheetDrag(onClose);
  const [printOut, setPrintOut] = useState<PrintOutDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    api
      .fetchPrintOut(id)
      .then(setPrintOut)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open that print-out"));
  }, [id]);

  const lines = useMemo(() => printOut?.lines ?? [], [printOut]);
  const labels = useMemo(() => lineLabels(lines), [lines]);
  const states = lines.map((line) => lineState(line, itemById));
  const open = states.filter((s) => s.kind === "open").length;

  function toggle(i: number) {
    setPicked((set) => {
      const next = new Set(set);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

  function markDone() {
    const chosen = [...picked].filter((i) => states[i].kind === "open").map((i) => lines[i]);
    const items = chosen.flatMap((l) => (l.stepId ? [] : [itemById.get(l.itemId)!]));
    const finishing = new Set(items.map((i) => i.id));
    // A step of a job being finished anyway needs nothing of its own.
    const steps = chosen.filter((l) => l.stepId && !finishing.has(l.itemId));
    for (const item of items) patchItem(item.id, { status: "DONE" });
    for (const l of steps) patchItem(l.itemId, { stepDone: { id: l.stepId!, done: true } });
    const n = items.length + steps.length;
    toast({
      message: `Ticked off ${n} from the print-out`,
      action: {
        label: "Undo",
        run: () => {
          for (const item of items) patchItem(item.id, { status: item.status, actualPrice: item.actualPrice });
          for (const l of steps) patchItem(l.itemId, { stepDone: { id: l.stepId!, done: false } });
        },
      },
    });
    onClose();
  }

  // Like deleting items: gone at once, really gone when the undo window closes.
  function throwAway() {
    hidePrintOut(id, true);
    const timer = window.setTimeout(() => {
      api.deletePrintOut(id).catch((err) => {
        hidePrintOut(id, false);
        toast({ message: err instanceof Error ? err.message : "Couldn't delete that print-out", tone: "error" });
      });
    }, UNDO_MS);
    toast({
      message: `Deleted the print-out “${printOut?.title ?? ""}”`,
      action: {
        label: "Undo",
        run: () => {
          window.clearTimeout(timer);
          hidePrintOut(id, false);
        },
      },
    });
    onClose();
  }

  const count = [...picked].filter((i) => states[i]?.kind === "open").length;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Tick off from paper"
      className={clsx(
        leaving && "sheet-leaving",
        "sheet m-0 inset-x-0 top-auto bottom-0 flex h-[min(90dvh,820px)] w-full max-w-none flex-col overflow-hidden rounded-t-sheet bg-surface p-0 text-ink shadow-sheet lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:w-[480px] lg:rounded-none lg:rounded-l-sheet",
      )}
    >
      <div {...dragHandlers} className="relative flex touch-none items-start justify-between gap-3 px-5 pt-5 pb-3">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <div>
          <h2 className="text-sheet-title leading-tight font-bold tracking-[-0.015em]">Tick off from paper</h2>
          {printOut && (
            <p className="mt-1 text-supporting text-ink-2">
              {printOut.title} · printed {describeDay(toDayString(new Date(printOut.createdAt)))} by{" "}
              {printOut.createdBy}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hit grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sunken"
        >
          <X size={19} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {error ? (
          <p className="px-2 py-6 text-body text-ink-2">{error}</p>
        ) : !printOut ? (
          <p className="px-2 py-6 text-body text-ink-3">Opening the print-out…</p>
        ) : (
          <>
            <p className="px-2 pb-2 text-supporting text-ink-2">
              {open ? "Tap what you ticked on paper." : "Everything on this print-out is already done or gone."}
            </p>
            <ol className="grid">
              {lines.map((line, i) => {
                const state = states[i];
                const heading = line.group && line.group !== lines[i - 1]?.group ? line.group : null;
                const under = /[a-z]$/.test(labels[i]);
                const on = state.kind === "done" || picked.has(i);
                return (
                  <Fragment key={`${line.itemId}-${line.stepId ?? ""}-${i}`}>
                    {heading && <li className="px-2 pt-4 pb-1 text-supporting font-bold text-ink">{heading}</li>}
                    <li>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={state.kind !== "open"}
                        onClick={() => toggle(i)}
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-control px-2 text-left transition-colors",
                          under ? "min-h-11 pl-9 text-supporting" : "min-h-12 text-body",
                          state.kind === "open" && "hover:bg-sunken/60",
                        )}
                      >
                        <span className="w-7 shrink-0 text-right text-meta text-ink-3 tabular">{labels[i]}</span>
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "grid shrink-0 place-items-center rounded-[6px] border-[1.5px] transition-colors",
                            under ? "h-5 w-5" : "h-6 w-6",
                            on ? "border-accent bg-accent text-accent-ink" : "border-tick-ring",
                            state.kind === "done" && "opacity-50",
                          )}
                        >
                          {on && <Check size={under ? 13 : 15} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 py-2">
                          <span className={clsx(state.kind === "open" ? "text-ink" : "text-ink-3 line-through")}>
                            {line.text}
                          </span>
                          {state.kind !== "open" && (
                            <span className="block text-meta text-ink-3 no-underline">
                              {state.kind === "gone"
                                ? "No longer on the list"
                                : state.by
                                  ? `Done already, by ${state.by}`
                                  : "Done already"}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {printOut ? (
          <Button variant="danger" onClick={throwAway} className="px-3">
            <Trash2 size={16} aria-hidden="true" />
            Delete
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose} className="px-3">
            Cancel
          </Button>
        )}
        <Button onClick={markDone} disabled={!count} className="ml-auto min-w-36">
          {count ? `Mark ${count} done` : "Mark done"}
        </Button>
      </div>
    </dialog>
  );
}
