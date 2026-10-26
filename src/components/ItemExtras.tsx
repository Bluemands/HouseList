"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Plus, Send, X } from "lucide-react";
import type { ItemDTO } from "@/lib/types";
import { useStore } from "@/lib/store";
import { formatGBP, timeAgo } from "@/lib/format";
import { Button, Field, MoneyInput, inputClass } from "@/components/ui";

/**
 * Quotes from people who'd do the job, cheapest first. Choosing one makes it
 * the item's cost; `onChosen` lets the open sheet pick that up too. Read only,
 * they're just the list, with the chosen one marked.
 */
export function QuotesField({
  item,
  onChosen,
  readOnly = false,
}: {
  item: ItemDTO;
  onChosen?: (item: ItemDTO) => void;
  readOnly?: boolean;
}) {
  const { addQuote, updateQuote, deleteQuote, toast, tradespeople } = useStore();

  // Like every other delete: gone at once, back with one tap.
  async function remove(q: ItemDTO["quotes"][number]) {
    const updated = await deleteQuote(q.id);
    if (!updated) return;
    toast({
      message: `Removed the quote from ${q.from}`,
      action: {
        label: "Undo",
        run: async () => {
          const restored = await addQuote(item.id, { from: q.from, amount: q.amount, note: q.note });
          const back = restored?.quotes.find((r) => !item.quotes.some((o) => o.id === r.id) && r.from === q.from);
          if (q.chosen && back) {
            const chosen = await updateQuote(back.id, { chosen: true });
            if (chosen) onChosen?.(chosen);
          }
        },
      },
    });
  }
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Most things never get a quote; keep the form folded away until asked for.
  const [adding, setAdding] = useState(false);
  const quotes = item.quotes;
  const lowest = quotes.length > 1 ? Math.min(...quotes.map((q) => q.amount)) : null;
  const spread = quotes.length > 1 ? Math.max(...quotes.map((q) => q.amount)) - (lowest ?? 0) : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(/,/g, ""));
    if (!from.trim()) return setError("Who's the quote from?");
    if (!amount.trim() || !Number.isFinite(n) || n < 0) return setError("Add the amount");
    setError(null);
    setBusy(true);
    const updated = await addQuote(item.id, { from: from.trim(), amount: n, note: note.trim() || null });
    setBusy(false);
    if (updated) {
      setFrom("");
      setAmount("");
      setNote("");
    }
  }

  return (
    <Field
      label="Quotes"
      hint={
        readOnly
          ? quotes.length > 1
            ? `${formatGBP(spread)} between the cheapest and dearest.`
            : undefined
          : quotes.length > 1
            ? `${formatGBP(spread)} between the cheapest and dearest. Choosing one sets the cost.`
            : "Get a few and compare. Choosing one sets the cost."
      }
    >
      {quotes.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-line">
          {quotes.map((q) => (
            <li
              key={q.id}
              className={clsx("flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0", q.chosen && "bg-accent-soft")}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-body font-semibold text-ink">{q.from}</span>
                  {q.amount === lowest && !q.chosen && (
                    <span className="shrink-0 text-label font-bold tracking-wide text-accent-text">LOWEST</span>
                  )}
                </div>
                {q.note && <p className="mt-0.5 text-meta text-ink-2">{q.note}</p>}
                <p className="mt-0.5 text-hint text-ink-3">
                  {q.addedBy} · {timeAgo(q.createdAt)}
                </p>
              </div>
              <span className="pt-px text-body font-semibold text-ink tabular">{formatGBP(q.amount)}</span>
              {readOnly ? (
                q.chosen && (
                  <span className="inline-flex shrink-0 items-center gap-1 px-2 py-1 text-meta font-bold text-accent-text">
                    <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Chosen
                  </span>
                )
              ) : q.chosen ? (
                <button
                  type="button"
                  onClick={() => updateQuote(q.id, { chosen: false })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-meta font-bold text-accent-text hover:bg-surface/60"
                  aria-label={`Unchoose the quote from ${q.from}`}
                >
                  <Check size={14} strokeWidth={2.6} /> Chosen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const updated = await updateQuote(q.id, { chosen: true });
                    if (updated) onChosen?.(updated);
                  }}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-meta font-semibold text-ink hover:border-accent hover:text-accent-text"
                >
                  Choose
                </button>
              )}
              {!readOnly && (
              <button
                type="button"
                aria-label={`Remove the quote from ${q.from}`}
                onClick={() => remove(q)}
                className="hit -mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <X size={14} />
              </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {readOnly ? null : quotes.length === 0 && !adding ? (
        <Button variant="secondary" onClick={() => setAdding(true)} className="justify-self-start px-3 py-2">
          <Plus size={15} /> Add a quote
        </Button>
      ) : (
        <form onSubmit={add} className="grid gap-2">
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <input
              autoFocus={adding && quotes.length === 0}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Who from?"
              aria-label="Quote from"
              maxLength={80}
              // People in the tradespeople book, so their quotes find them by name.
              list="tradespeople-names"
              className={inputClass}
            />
            <datalist id="tradespeople-names">
              {tradespeople.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.trade ?? undefined}
                </option>
              ))}
            </datalist>
            <MoneyInput label="Quote amount" value={amount} onChange={setAmount} placeholder="Amount" />
          </div>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's included? (optional)"
              aria-label="Quote note"
              maxLength={500}
              className={inputClass}
            />
            <Button type="submit" variant="secondary" disabled={busy} className="shrink-0">
              Add quote
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-meta font-medium text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </Field>
  );
}

/** A running thread of short updates, so neither of you has to relay them. */
export function UpdatesField({ item }: { item: ItemDTO }) {
  const { addComment, deleteComment, me } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const ok = await addComment(item.id, t);
    setBusy(false);
    if (ok) setText("");
  }

  return (
    <Field label="Updates">
      {item.comments.length > 0 && (
        <ul className="grid gap-3">
          {item.comments.map((c) => (
            <li key={c.id} className="group/c flex gap-2.5">
              <span
                aria-hidden="true"
                className={clsx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-hint font-bold",
                  c.author === me ? "bg-accent-soft text-accent-text" : "bg-sunken text-ink-2",
                )}
              >
                {c.author.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-meta text-ink-3">
                  <span className="font-semibold text-ink-2">{c.author}</span> · {timeAgo(c.createdAt)}
                </p>
                <p className="text-body leading-snug whitespace-pre-wrap text-ink">{c.text}</p>
              </div>
              {c.author === me && (
                <button
                  type="button"
                  aria-label="Delete this update"
                  onClick={() => deleteComment(c.id)}
                  className="hit grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={item.comments.length ? "Add an update…" : "e.g. Rang them, waiting for a callback"}
          aria-label="Add an update"
          maxLength={1000}
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={busy || !text.trim()} aria-label="Post update" className="shrink-0 px-3">
          <Send size={16} />
        </Button>
      </form>
    </Field>
  );
}
