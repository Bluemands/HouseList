"use client";

import { useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, today } from "@/lib/format";
import { BINS_MAX, BIN_COLOURS, binNames, binsOn, nextCollection, type Bin } from "@/lib/bins";
import { Button, Chip, Field, Segmented, inputClass } from "@/components/ui";

const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
/** "Tue 28 Oct". */
const showDay = (day: string) => dayLabel.format(new Date(`${day}T12:00:00`));

function Dots({ bins }: { bins: Bin[] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-1">
      {bins.map((b) => (
        <span key={b.id} className="h-4 w-4 rounded-full ring-2 ring-surface" style={{ background: b.colour }} />
      ))}
    </span>
  );
}

/** On both home screens: which bins go out tonight, or today. */
export function BinsNotice() {
  const { settings } = useStore();
  const day = today();
  const todays = binsOn(settings.bins, day);
  const tonight = binsOn(settings.bins, addDays(day, 1));
  const [bins, label] = todays.length ? [todays, "Bins today"] : [tonight, "Bins out tonight"];
  if (!bins.length) return null;
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <Dots bins={bins} />
      <p className="text-body text-ink">
        <span className="font-semibold">{label}:</span> {binNames(bins)}
      </p>
    </div>
  );
}

const EVERY = [
  { value: "1", label: "Weekly" },
  { value: "2", label: "2 weeks" },
  { value: "3", label: "3 weeks" },
  { value: "4", label: "4 weeks" },
];

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

/** In Settings: the bins, how often each goes out, and one-off changes. */
export function BinsField() {
  const { settings, saveSettings } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const bins = settings.bins;
  const day = today();

  async function save(list: Bin[]) {
    if (await saveSettings({ bins: list })) setEditing(null);
  }

  return (
    <Field
      label="Bins"
      hint={
        bins.length
          ? "Both home screens say which go out the day before, and phones with notifications on get a reminder that evening."
          : "Add each bin and how often it goes out, and the home screen says which go out the night before."
      }
    >
      {bins.length > 0 && (
        <ul className="grid gap-2">
          {bins.map((b) =>
            editing === b.id ? (
              <li key={b.id}>
                <BinEditor
                  bin={b}
                  onCancel={() => setEditing(null)}
                  onSave={(next) => save(bins.map((x) => (x.id === b.id ? next : x)))}
                  onRemove={() => save(bins.filter((x) => x.id !== b.id))}
                />
              </li>
            ) : (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setEditing(b.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-left hover:bg-sunken"
                >
                  <Dots bins={[b]} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-ink">{b.name}</span>
                    <span className="block text-meta text-ink-3">
                      {b.everyWeeks === 1 ? "Every week" : `Every ${b.everyWeeks} weeks`}
                      {(() => {
                        const next = nextCollection(b, day);
                        return next ? ` · next ${showDay(next.date)}${next.movedFrom ? " (moved)" : ""}` : "";
                      })()}
                    </span>
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {editing === "new" ? (
        <BinEditor bin={null} onCancel={() => setEditing(null)} onSave={(b) => save([...bins, b])} />
      ) : (
        bins.length < BINS_MAX && (
          <Button variant="secondary" onClick={() => setEditing("new")} className="justify-self-start">
            <Plus size={16} /> Add a bin
          </Button>
        )
      )}
    </Field>
  );
}

type Once = "normal" | "moved" | "skipped";

function BinEditor({
  bin,
  onSave,
  onCancel,
  onRemove,
}: {
  bin: Bin | null;
  onSave: (bin: Bin) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const day = today();
  const [name, setName] = useState(bin?.name ?? "");
  const [colour, setColour] = useState<string>(bin?.colour ?? BIN_COLOURS[0].hex);
  const [every, setEvery] = useState(String(bin?.everyWeeks ?? 2));
  // The next one as the pattern has it, before any change: what "just this once" is about.
  const due = bin ? nextCollection({ ...bin, changes: [] }, day)?.date : undefined;
  const change = due ? bin?.changes.find((c) => c.on === due) : undefined;
  const [from, setFrom] = useState(due ?? day);
  const [once, setOnce] = useState<Once>(!change ? "normal" : change.to ? "moved" : "skipped");
  const [movedTo, setMovedTo] = useState(change?.to ?? (due ? addDays(due, 1) : day));
  const patternChanged = !!bin && (from !== due || Number(every) !== bin.everyWeeks);
  const ready = name.trim().length > 0 && !!from;

  function save() {
    if (!ready) return;
    let changes = (bin?.changes ?? []).filter((c) => c.on !== due);
    // A new pattern leaves this time's change behind, since it may not fall on the same day.
    if (due && !patternChanged && once !== "normal") changes = [...changes, { on: due, to: once === "moved" ? movedTo : null }];
    onSave({ id: bin?.id ?? newId(), name: name.trim(), colour, everyWeeks: Number(every), from, changes });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-line-strong p-3.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recycling"
        aria-label="Bin name"
        maxLength={40}
        autoFocus={!bin}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
        {BIN_COLOURS.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={colour === c.hex}
            aria-label={c.name}
            onClick={() => setColour(c.hex)}
            className={clsx(
              "hit grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-shadow",
              colour === c.hex ? "ring-2 ring-accent" : "ring-1 ring-line",
            )}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: c.hex }} />
          </button>
        ))}
      </div>
      <Segmented label="How often" value={every} onChange={setEvery} options={EVERY} size="sm" />
      <label className="grid gap-1.5 text-meta font-semibold text-ink-2">
        {bin ? "Next collection" : "When it’s next collected"}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={clsx(inputClass, "tabular")} />
      </label>

      {due && !patternChanged && (
        <div className="grid gap-2">
          <span className="text-meta font-semibold text-ink-2">Just this once ({showDay(due)})</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={once === "normal"} onClick={() => setOnce("normal")}>
              As normal
            </Chip>
            <Chip selected={once === "moved"} onClick={() => setOnce("moved")}>
              Another day
            </Chip>
            <Chip selected={once === "skipped"} onClick={() => setOnce("skipped")}>
              Not collected
            </Chip>
          </div>
          {once === "moved" && (
            <input
              type="date"
              value={movedTo}
              onChange={(e) => e.target.value && setMovedTo(e.target.value)}
              aria-label="Collected instead on"
              className={clsx(inputClass, "tabular")}
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        {onRemove && (
          <Button variant="danger" onClick={onRemove} className="px-3 py-2">
            Remove
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCancel} className="px-3 py-2">
          Cancel
        </Button>
        <Button onClick={save} disabled={!ready} className="px-4 py-2">
          Save
        </Button>
      </div>
    </div>
  );
}
