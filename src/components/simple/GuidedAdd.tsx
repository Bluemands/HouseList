"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowLeft, Check, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROOMS, type Priority, type Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { parseQuickAdd } from "@/lib/parse";
import { Button, PaintChip } from "@/components/ui";

type Step = "what" | "room" | "soon" | "added";

const SOON: { priority: Priority; label: string; hint: string }[] = [
  { priority: "MUST_HAVE", label: "Soon", hint: "It needs doing" },
  { priority: "WOULD_LIKE", label: "When we can", hint: "No rush" },
  { priority: "SOMEDAY", label: "One day", hint: "A nice-to-have" },
];

/**
 * Adding, one question at a time: what, which room, how soon. Big answers,
 * nothing else on screen. What she writes goes in as an ordinary item, so the
 * full layout's plans and money pick it up like anything else.
 */
export function GuidedAdd({ leaving, onClose }: { leaving: boolean; onClose: () => void }) {
  const { addItem, settings } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [step, setStep] = useState<Step>("what");
  const [text, setText] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [added, setAdded] = useState<{ title: string; room: Room } | null>(null);
  const parsed = useMemo(() => parseQuickAdd(text.trim(), settings.members), [text, settings.members]);

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    if (step === "what") inputRef.current?.focus();
  }, [step]);

  function toRoom() {
    if (!text.trim()) return;
    // The words often name the room ("kitchen tap"); start there.
    setRoom(parsed.room);
    setStep("room");
  }

  async function add(priority: Priority) {
    const title = (parsed.title || text).trim();
    const where = room ?? "WHOLE_HOUSE";
    setAdded({ title, room: where });
    setStep("added");
    await addItem({
      title,
      kind: parsed.kind,
      room: where,
      priority,
      dueDate: parsed.dueDate,
      estimatedPrice: parsed.estimatedPrice,
      estimateMax: parsed.estimateMax,
      repeat: parsed.repeat,
    });
  }

  function again() {
    setText("");
    setRoom(null);
    setAdded(null);
    setStep("what");
  }

  const back: Partial<Record<Step, Step>> = { room: "what", soon: "room" };
  const number = { what: 1, room: 2, soon: 3, added: 3 }[step];

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label="Add something"
      className={clsx(
        leaving && "sheet-leaving",
        "sheet m-0 inset-0 flex h-dvh max-h-none w-full max-w-none flex-col bg-surface p-0 text-ink",
        "lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[480px] lg:rounded-l-sheet lg:shadow-sheet",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        {back[step] ? (
          <button
            type="button"
            onClick={() => setStep(back[step]!)}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-body font-semibold text-ink-2 hover:text-ink"
          >
            <ArrowLeft size={18} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}
        {step !== "added" && <span className="text-meta text-ink-3 tabular">{number} of 3</span>}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hit grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-sunken"
        >
          <X size={21} />
        </button>
      </div>

      <div key={step} className="rise-in flex flex-1 flex-col overflow-y-auto px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        {step === "what" && (
          <form
            className="flex flex-1 flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              toRoom();
            }}
          >
            <label htmlFor="guided-what" className="text-headline leading-tight font-bold tracking-[-0.025em]">
              What needs doing?
            </label>
            <textarea
              id="guided-what"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\n/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  toRoom();
                }
              }}
              rows={2}
              maxLength={200}
              enterKeyHint="next"
              placeholder="e.g. Fix the bathroom tap"
              className="w-full resize-none rounded-2xl border border-line bg-bg px-4 py-3.5 text-item-lead leading-snug text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
            <Button type="submit" disabled={!text.trim()} className="mt-auto h-14 text-title">
              Next
            </Button>
          </form>
        )}

        {step === "room" && (
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-headline leading-tight font-bold tracking-[-0.025em]">Which room?</h2>
            <div className="grid grid-cols-2 gap-2">
              {ROOMS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRoom(r);
                    setStep("soon");
                  }}
                  aria-pressed={room === r}
                  className={clsx(
                    "flex min-h-14 items-center gap-2.5 rounded-2xl border px-3.5 text-left text-body font-semibold transition-colors",
                    room === r ? "border-accent bg-accent-soft text-accent-text" : "border-line bg-bg text-ink hover:border-line-strong",
                  )}
                >
                  <PaintChip room={r} />
                  <span className="min-w-0">{ROOM_PAINT[r].label}</span>
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setRoom((r) => r ?? "WHOLE_HOUSE");
                setStep("soon");
              }}
              className="h-12 text-title"
            >
              {room ? `Keep ${ROOM_PAINT[room].label}` : "Not sure"}
            </Button>
          </div>
        )}

        {step === "soon" && (
          <div className="flex flex-1 flex-col gap-4">
            <h2 className="text-headline leading-tight font-bold tracking-[-0.025em]">How soon?</h2>
            <div className="grid gap-2.5">
              {SOON.map((s) => (
                <button
                  key={s.priority}
                  type="button"
                  onClick={() => add(s.priority)}
                  className="grid min-h-16 gap-0.5 rounded-2xl border border-line bg-bg px-4 py-3 text-left transition-colors hover:border-accent active:bg-accent-soft"
                >
                  <span className="text-item-lead font-semibold text-ink">{s.label}</span>
                  <span className="text-supporting text-ink-2">{s.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "added" && added && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-ink">
              <Check size={32} strokeWidth={3} aria-hidden="true" />
            </span>
            <h2 className="text-sheet-title leading-tight font-bold tracking-[-0.015em]">Added</h2>
            <p className="max-w-[30ch] text-body text-ink-2">
              {added.title}
              <span className="mt-1.5 flex items-center justify-center gap-1.5 text-supporting">
                <PaintChip room={added.room} /> {ROOM_PAINT[added.room].label}
              </span>
            </p>
            <div className="mt-6 grid w-full max-w-[360px] gap-2.5">
              <Button onClick={again} className="h-14 text-title">
                Add another
              </Button>
              <Button variant="secondary" onClick={onClose} className="h-12 text-title">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
