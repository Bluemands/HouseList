"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Calendar, Repeat, User, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { ROOM_PAINT } from "@/lib/rooms";
import { PRIORITY_LABELS, REPEAT_SHORT } from "@/lib/types";
import { describeDue, formatCost } from "@/lib/format";
import type { ItemCreateInput } from "@/lib/validation";
import { Button, PaintChip } from "@/components/ui";

export type BulkCandidate = Omit<ItemCreateInput, "addedBy"> & { why?: string };

/**
 * A checklist of things to add in one go — a pasted list, or the new-home
 * essentials. Everything starts ticked; untick what you don't want.
 */
export function BulkAddSheet({
  title,
  intro,
  candidates,
  onClose,
}: {
  title: string;
  intro?: string;
  candidates: BulkCandidate[];
  onClose: () => void;
}) {
  const { addItems, items } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const dragHandlers = useSheetDrag(onClose);
  const existing = useMemo(() => new Set(items.map((i) => i.title.trim().toLowerCase())), [items]);
  const [picked, setPicked] = useState<boolean[]>(() =>
    candidates.map((c) => !existing.has(c.title.trim().toLowerCase())),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const count = picked.filter(Boolean).length;

  async function add() {
    setBusy(true);
    const chosen = candidates
      .filter((_, i) => picked[i])
      .map((c) => {
        const rest = { ...c };
        delete rest.why;
        return rest;
      });
    const added = await addItems(chosen);
    setBusy(false);
    if (added) onClose();
  }

  return (
    <dialog
      ref={ref}
      // Not onClose: unmounting closes the dialog too, and that must not
      // read as the person dismissing it.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={title}
      className="sheet m-0 inset-x-0 top-auto bottom-0 flex h-[min(90dvh,820px)] w-full max-w-none flex-col overflow-hidden rounded-t-[22px] bg-surface p-0 text-ink shadow-sheet lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:w-[480px] lg:rounded-none lg:rounded-l-[22px]"
    >
      <div {...dragHandlers} className="relative flex touch-none items-start justify-between gap-3 px-5 pt-5 pb-3">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">{title}</h2>
          {intro && <p className="mt-1 text-[14px] text-ink-2">{intro}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-sunken">
          <X size={19} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto overscroll-contain border-t border-line px-2">
        {candidates.map((c, i) => {
          const already = existing.has(c.title.trim().toLowerCase());
          const cost = formatCost(c.estimatedPrice ?? null, c.estimateMax ?? null);
          const room = c.room ?? "WHOLE_HOUSE";
          return (
            <li key={`${c.title}-${i}`} className="border-b border-line last:border-b-0">
              <label className={clsx("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 hover:bg-sunken/60", already && "opacity-60")}>
                <input
                  type="checkbox"
                  checked={picked[i]}
                  onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-medium text-ink">{c.title}</span>
                    {cost && <span className="shrink-0 text-[13.5px] text-ink-2 tabular">{cost}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <PaintChip room={room} className="!h-2.5 !w-2.5" />
                      {ROOM_PAINT[room].label}
                    </span>
                    {c.priority === "MUST_HAVE" && <span className="font-semibold text-ink">{PRIORITY_LABELS.MUST_HAVE}</span>}
                    {c.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} strokeWidth={2.2} aria-hidden="true" />
                        {describeDue(c.dueDate).label}
                      </span>
                    )}
                    {typeof c.assignee === "string" && c.assignee && (
                      <span className="inline-flex items-center gap-1">
                        <User size={11} strokeWidth={2.2} aria-hidden="true" />
                        {c.assignee}
                      </span>
                    )}
                    {c.repeat && (
                      <span className="inline-flex items-center gap-1">
                        <Repeat size={11} strokeWidth={2.2} aria-hidden="true" />
                        {REPEAT_SHORT[c.repeat]}
                      </span>
                    )}
                    {already && <span className="italic">Already on your list</span>}
                  </span>
                  {c.why && <span className="mt-1 block text-[13px] text-ink-3">{c.why}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setPicked((p) => p.map(() => count === 0))}
          className="rounded-lg px-2 py-2 text-[14px] font-semibold text-ink-2 hover:text-ink"
        >
          {count === 0 ? "Select all" : "Select none"}
        </button>
        <Button onClick={add} disabled={!count || busy} className="ml-auto min-w-36">
          {busy ? "Adding…" : `Add ${count} ${count === 1 ? "thing" : "things"}`}
        </Button>
      </div>
    </dialog>
  );
}
