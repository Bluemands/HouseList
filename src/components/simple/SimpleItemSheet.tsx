"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROOMS, type ItemDTO, type Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { useSheetDrag, useSheetExit } from "@/lib/useSheetDrag";
import { stepLines } from "@/lib/printouts";
import { Button, Chip, GrowingTextarea, PaintChip, RoomTag, inputClass } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { PhotosField } from "@/components/Photos";

/**
 * One thing, in the simple layout: what it's called, where, its steps,
 * photos and notes. Nothing else; the money, plan and Claude live in the full layout.
 * It opens to read, where only ticking steps and adding photos change
 * anything; Edit brings the form, and closing that saves, as in the full sheet.
 */
export function SimpleItemSheet() {
  const { editing, items, closeItem } = useStore();
  const item = editing && editing.id !== "new" ? items.find((i) => i.id === editing.id) : undefined;
  // New things are added the guided way; a deleted one lets go.
  useEffect(() => {
    if (editing && !item) closeItem();
  }, [editing, item, closeItem]);
  const { shown, leaving, opening } = useSheetExit(item ?? null);
  if (!shown) return null;
  return <Body key={`${opening}:${shown.id}`} item={shown} leaving={leaving} />;
}

type DraftStep = { id?: string; key: string; text: string; done: boolean; cost: number | null; link: string | null; notes: string | null };

function Body({ item, leaving }: { item: ItemDTO; leaving: boolean }) {
  const { closeItem, patchItem, removeItem, toggleStep } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [room, setRoom] = useState<Room>(item.room);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => item.steps.map((s) => ({ ...s, key: s.id })));
  const [newStep, setNewStep] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

  const changedSteps = useMemo(
    () =>
      newStep.trim() !== "" ||
      steps.length !== item.steps.length ||
      steps.some((s, i) => s.id !== item.steps[i]?.id || s.text !== item.steps[i]?.text || s.done !== item.steps[i]?.done),
    [steps, newStep, item.steps],
  );

  function save() {
    const patch: Parameters<typeof patchItem>[1] = {};
    if (title.trim() && title.trim() !== item.title) patch.title = title.trim();
    if (room !== item.room) patch.room = room;
    if ((notes.trim() || null) !== (item.notes ?? null)) patch.notes = notes.trim() || null;
    if (changedSteps) {
      const all = newStep.trim() ? [...steps, { key: "new", text: newStep.trim(), done: false, cost: null, link: null, notes: null }] : steps;
      patch.steps = all.map(({ id, text, done, cost, link, notes: n }) => ({ id, text, done, cost, link, notes: n }));
    }
    closeItem();
    if (Object.keys(patch).length) patchItem(item.id, patch);
  }

  // Reading, there's nothing to save: the form's copy may be older than the item.
  const close = editing ? save : closeItem;
  const dragHandlers = useSheetDrag(close);

  // The form starts from the item as it is now, ticks made while reading included.
  function startEditing() {
    setTitle(item.title);
    setRoom(item.room);
    setNotes(item.notes ?? "");
    setSteps(item.steps.map((s) => ({ ...s, key: s.id })));
    setNewStep("");
    setEditing(true);
  }

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  // The room rail opens at this item's room.
  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (rail && chip) rail.scrollLeft += chip.getBoundingClientRect().left - rail.getBoundingClientRect().left - 20;
  }, [editing]);

  function addStep() {
    const text = newStep.trim();
    if (!text) return;
    setSteps((list) => [...list, { key: `new-${Date.now()}`, text, done: false, cost: null, link: null, notes: null }]);
    setNewStep("");
  }

  return (
    <dialog
      ref={ref}
      aria-label={editing ? `Edit ${item.title}` : item.title}
      onCancel={(e) => {
        e.preventDefault();
        if (!leaving) close();
      }}
      onClick={(e) => e.target === e.currentTarget && !leaving && close()}
      className={clsx(
        leaving && "sheet-leaving",
        "sheet m-0 inset-x-0 top-auto bottom-0 flex h-[min(88dvh,780px)] w-full max-w-none flex-col overflow-hidden rounded-t-sheet bg-surface p-0 text-ink shadow-sheet",
        "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:w-[460px] lg:rounded-none lg:rounded-l-sheet",
      )}
    >
      <div {...dragHandlers} className="relative flex touch-none items-center justify-end px-4 pt-4">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="hit grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-sunken"
        >
          <X size={19} />
        </button>
      </div>

      {editing ? (
        <div className="grid flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 pb-6">
          <textarea
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            aria-label="What needs doing"
            maxLength={200}
            className="field-sizing-content w-full resize-none bg-transparent text-sheet-title leading-tight font-bold tracking-[-0.015em] text-ink outline-none"
          />

          <section className="grid gap-2">
            <h3 className="text-supporting font-semibold text-ink-2">Room</h3>
            <div ref={railRef} className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {ROOMS.map((r) => (
                <Chip key={r} selected={room === r} onClick={() => setRoom(r)} className="py-2 text-supporting">
                  <PaintChip room={r} />
                  {ROOM_PAINT[r].label}
                </Chip>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <h3 className="text-supporting font-semibold text-ink-2">Steps</h3>
            {steps.length > 0 && (
              <ul className="border-t border-line">
                {steps.map((s) => (
                  <li key={s.key} className="flex items-center gap-2 border-b border-line">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={s.done}
                      aria-label={`Done: ${s.text}`}
                      onClick={() => setSteps((list) => list.map((x) => (x.key === s.key ? { ...x, done: !x.done } : x)))}
                      className="grid h-11 w-9 shrink-0 place-items-center"
                    >
                      <StepBox done={s.done} />
                    </button>
                    <input
                      value={s.text}
                      onChange={(e) => setSteps((list) => list.map((x) => (x.key === s.key ? { ...x, text: e.target.value } : x)))}
                      aria-label="Step"
                      className={clsx("min-w-0 flex-1 bg-transparent py-2.5 text-body outline-none", s.done && "text-ink-3 line-through")}
                    />
                    <button
                      type="button"
                      onClick={() => setSteps((list) => list.filter((x) => x.key !== s.key))}
                      aria-label={`Remove “${s.text}”`}
                      className="hit grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addStep();
              }}
            >
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder={steps.length ? "Add another step" : "Break it into steps (optional)"}
                aria-label="New step"
                maxLength={200}
                className={inputClass}
              />
              <Button type="submit" variant="secondary" disabled={!newStep.trim()} aria-label="Add step" className="shrink-0 px-3">
                <Plus size={17} />
              </Button>
            </form>
            {item.steps.some((s) => !s.done) && (
              <PrintButton
                title={item.title}
                lines={() => stepLines(item)}
                label="Print the steps"
                before={save}
                className="-ml-3 justify-self-start"
              />
            )}
          </section>

          <section className="grid gap-2">
            <h3 className="text-supporting font-semibold text-ink-2">Photos</h3>
            <PhotosField item={item} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-supporting font-semibold text-ink-2">Notes</h3>
            <GrowingTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              minRows={3}
              maxLength={4000}
              aria-label="Notes"
              placeholder="Anything worth remembering"
              className={inputClass}
            />
          </section>
        </div>
      ) : (
        <div className="grid flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 pb-6">
          <div className="grid gap-1.5">
            <h2 className="text-sheet-title leading-tight font-bold tracking-[-0.015em] text-ink">{item.title}</h2>
            <p className="text-supporting text-ink-2">
              <RoomTag room={item.room} />
            </p>
          </div>

          {item.steps.length > 0 && (
            <section className="grid gap-2">
              <h3 className="text-supporting font-semibold text-ink-2">Steps</h3>
              <ul className="border-t border-line">
                {item.steps.map((s) => (
                  <li key={s.id} className="border-b border-line">
                    {/* The whole row ticks, like a line on paper. */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={s.done}
                      onClick={() => toggleStep(item, s.id)}
                      className="flex min-h-11 w-full items-center gap-2 py-2.5 text-left"
                    >
                      <span className="grid w-9 shrink-0 place-items-center">
                        <StepBox done={s.done} />
                      </span>
                      <span className={clsx("min-w-0 flex-1 text-body", s.done && "text-ink-3 line-through")}>{s.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {item.steps.some((s) => !s.done) && (
                <PrintButton
                  title={item.title}
                  lines={() => stepLines(item)}
                  label="Print the steps"
                  className="-ml-3 justify-self-start"
                />
              )}
            </section>
          )}

          <section className="grid gap-2">
            <h3 className="text-supporting font-semibold text-ink-2">Photos</h3>
            <PhotosField item={item} />
          </section>

          {item.notes && (
            <section className="grid gap-2">
              <h3 className="text-supporting font-semibold text-ink-2">Notes</h3>
              <p className="text-body leading-snug whitespace-pre-wrap text-ink">{item.notes}</p>
            </section>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {editing ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                closeItem();
                removeItem(item);
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete
            </Button>
            <Button onClick={save} className="ml-auto min-w-28">
              Done
            </Button>
          </>
        ) : (
          <Button onClick={startEditing} className="ml-auto min-w-28">
            <Pencil size={16} aria-hidden="true" /> Edit
          </Button>
        )}
      </div>
    </dialog>
  );
}

function StepBox({ done }: { done: boolean }) {
  return (
    <span
      className={clsx(
        "grid h-5 w-5 place-items-center rounded-[5px] border-[1.5px]",
        done ? "border-accent bg-accent text-accent-ink" : "border-tick-ring",
      )}
    >
      {done && <Check size={13} strokeWidth={3} />}
    </span>
  );
}
