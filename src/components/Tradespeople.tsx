"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, HardHat, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSheetExit } from "@/lib/useSheetDrag";
import { formatGBP } from "@/lib/format";
import {
  TRADES,
  VERDICTS,
  VERDICT_LABELS,
  telHref,
  unsavedQuoters,
  workFor,
  type TradespersonDTO,
  type Verdict,
} from "@/lib/tradespeople";
import { MiniSheet } from "@/components/MiniSheet";
import { Button, Chip, Field, GrowingTextarea, PaintChip, SectionHead, inputClass } from "@/components/ui";

// The tradespeople book: who's quoted or done work, how to reach them, and
// whether you'd have them back. Opened from the Home tab.

/** On the Home tab: the way into the book. */
export function TradespeopleLink() {
  const { tradespeople, items } = useStore();
  const [open, setOpen] = useState(false);
  const sheet = useSheetExit(open || null);
  const unsaved = unsavedQuoters(items, tradespeople).length;
  return (
    <section aria-labelledby="trades-head">
      <SectionHead id="trades-head" title="Tradespeople" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:bg-sunken"
      >
        <HardHat size={20} className="shrink-0 text-ink-2" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-ink">
            {tradespeople.length
              ? `${tradespeople.length} in the book`
              : "Keep the good ones"}
          </span>
          <span className="block text-meta text-ink-3">
            {unsaved
              ? `${unsaved} from your quotes to save`
              : "Numbers, what they did, and whether you’d have them back"}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden="true" />
      </button>
      {sheet.shown && <TradespeopleSheet key={sheet.opening} leaving={sheet.leaving} onClose={() => setOpen(false)} />}
    </section>
  );
}

type View = { kind: "list" } | { kind: "person"; id: string | null; name?: string };

function TradespeopleSheet({ leaving, onClose }: { leaving: boolean; onClose: () => void }) {
  const { tradespeople } = useStore();
  const [view, setView] = useState<View>({ kind: "list" });
  const person = view.kind === "person" && view.id ? tradespeople.find((p) => p.id === view.id) : undefined;
  const back = () => setView({ kind: "list" });
  return (
    <MiniSheet
      title={view.kind === "list" ? "Tradespeople" : (person?.name ?? "Someone new")}
      leaving={leaving}
      onClose={onClose}
    >
      {view.kind === "list" ? (
        <Book onOpen={(id, name) => setView({ kind: "person", id, name })} />
      ) : (
        <>
          <button
            type="button"
            onClick={back}
            className="-ml-1 inline-flex items-center gap-0.5 justify-self-start text-supporting font-semibold text-accent-text hover:underline"
          >
            <ChevronLeft size={17} /> Everyone
          </button>
          <PersonForm
            key={view.id ?? `new:${view.name ?? ""}`}
            person={person}
            name={view.name}
            onSaved={back}
            onRemoved={back}
            onOpenItem={onClose}
          />
        </>
      )}
    </MiniSheet>
  );
}

/** Everyone in the book, and anyone who's quoted but isn't in it yet. */
function Book({ onOpen }: { onOpen: (id: string | null, name?: string) => void }) {
  const { tradespeople, items } = useStore();
  const unsaved = unsavedQuoters(items, tradespeople);
  return (
    <>
      <Button variant="secondary" onClick={() => onOpen(null)} className="justify-self-start">
        <Plus size={16} /> Add someone
      </Button>
      {tradespeople.length > 0 ? (
        <ul className="border-t border-line">
          {tradespeople.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b border-line">
              <button type="button" onClick={() => onOpen(p.id)} className="min-w-0 flex-1 py-2.5 text-left">
                <span className="block truncate text-body font-semibold text-ink">{p.name}</span>
                <span className="block truncate text-meta text-ink-3">
                  {[p.trade, p.verdict && VERDICT_LABELS[p.verdict]].filter(Boolean).join(" · ") || "No details yet"}
                </span>
              </button>
              {p.phone && (
                <a
                  href={telHref(p.phone)}
                  aria-label={`Call ${p.name}`}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-accent-text hover:bg-accent-soft"
                >
                  <Phone size={18} />
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-supporting text-ink-2">
          Nobody yet. Add the people who’ve quoted or done work, so the good ones are easy to find again.
        </p>
      )}
      {unsaved.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-meta font-semibold text-ink-2">From your quotes</span>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {unsaved.map((q) => (
              <li key={q.name} className="flex items-center gap-3 text-supporting">
                <span className="min-w-0 flex-1 truncate text-ink">
                  {q.name}{" "}
                  <span className="text-ink-3">
                    · {q.count} {q.count === 1 ? "quote" : "quotes"}
                  </span>
                </span>
                <Button variant="ghost" onClick={() => onOpen(null, q.name)} className="px-3 py-1.5 text-accent-text">
                  <Plus size={15} /> Save
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** One person: their details, how to reach them, and what they've quoted for or done. */
function PersonForm({
  person,
  name: startName,
  onSaved,
  onRemoved,
  onOpenItem,
}: {
  person?: TradespersonDTO;
  name?: string;
  onSaved: () => void;
  onRemoved: () => void;
  onOpenItem: () => void;
}) {
  const { items, addTradesperson, updateTradesperson, removeTradesperson, openItem } = useStore();
  const [name, setName] = useState(person?.name ?? startName ?? "");
  const [trade, setTrade] = useState(person?.trade ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [verdict, setVerdict] = useState<Verdict | null>(person?.verdict ?? null);
  const [busy, setBusy] = useState(false);
  const work = name.trim() ? workFor(name, items) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const fields = { name: name.trim(), trade, phone, email, notes, verdict };
    const saved = person ? await updateTradesperson(person.id, fields) : await addTradesperson(fields);
    setBusy(false);
    if (saved) onSaved();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      {person && (person.phone || person.email) && (
        <div className="flex flex-wrap gap-2">
          {person.phone && (
            <a
              href={telHref(person.phone)}
              className="inline-flex items-center gap-1.5 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              <Phone size={16} /> Call
            </a>
          )}
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sunken"
            >
              <Mail size={16} /> Email
            </a>
          )}
        </div>
      )}

      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Who, or which firm"
          maxLength={80}
          autoFocus={!person && !startName}
          className={inputClass}
        />
      </Field>

      <Field label="What they do">
        <input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Electrician" maxLength={60} className={inputClass} />
        <div className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {TRADES.map((t) => (
            <Chip key={t} selected={trade === t} onClick={() => setTrade(trade === t ? "" : t)}>
              {t}
            </Chip>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} className={inputClass} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} className={inputClass} />
        </Field>
      </div>

      <Field label="Would you have them back?">
        <div className="flex flex-wrap gap-1.5">
          {VERDICTS.map((v) => (
            <Chip key={v} selected={verdict === v} onClick={() => setVerdict(verdict === v ? null : v)}>
              {v === "YES" ? "Yes" : v === "NOT_SURE" ? "Not sure" : "No"}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <GrowingTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minRows={2}
          placeholder="Tidy, turned up on time, recommended by next door…"
          maxLength={2000}
          aria-label="Notes"
          className={inputClass}
        />
      </Field>

      {work.length > 0 && (
        <Field label="Quotes and jobs">
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {work.map(({ item, quote }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenItem();
                    openItem(item.id);
                  }}
                  className="flex w-full items-center gap-2.5 py-1.5 text-left text-supporting hover:text-accent-text"
                >
                  <PaintChip room={item.room} />
                  <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
                  <span className="shrink-0 text-ink-3 tabular">
                    {quote ? `${formatGBP(quote.amount)}${quote.chosen ? " · chosen" : ""}` : "Their job"}
                    {item.status === "DONE" && " · done"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Field>
      )}

      <div className="flex items-center gap-2">
        {person && (
          <Button
            variant="danger"
            onClick={() => {
              removeTradesperson(person);
              onRemoved();
            }}
            aria-label={`Take ${person.name} out of the book`}
            className="px-3"
          >
            <Trash2 size={17} />
          </Button>
        )}
        <Button type="submit" disabled={!name.trim() || busy} className="min-h-11 flex-1">
          {person ? "Save" : "Add to the book"}
        </Button>
      </div>
    </form>
  );
}
