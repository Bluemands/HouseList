"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ExternalLink, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import type { ItemDTO } from "@/lib/types";
import { workerState, type AiJobDTO, type AiResult } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { formatCost, formatGBP, linkLabel, timeAgo } from "@/lib/format";
import { Button, Field, inputClass } from "@/components/ui";

type Step = NonNullable<AiResult["steps"]>[number];
/** Each change hands back how to take it away again. */
type Undo = () => void;

const DIY_LABELS: Record<NonNullable<AiResult["diy"]>, string> = {
  yes: "Fine to DIY",
  "with-care": "DIY with care",
  no: "One for a tradesperson",
};

/** A small one-tap action on the card, at a full 44px tall. */
function CardAction({ done, onClick, children }: { done?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      className={clsx(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 justify-self-start rounded-[10px] border px-3 text-[13px] font-semibold transition-colors",
        done
          ? "border-accent bg-accent-soft text-accent-text"
          : "border-line bg-surface text-ink hover:border-accent hover:text-accent-text",
      )}
    >
      {done && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * Ask Claude about an item. Asking only queues it: a worker on someone's
 * computer runs it past Claude, and the answer arrives with the next sync as
 * a suggestion. Using a part of it changes the sheet's draft like typing
 * would (so it saves with everything else), or logs a quote; each can be
 * taken back with a second tap.
 */
export function AskClaude({
  item,
  canSetEstimate,
  onEstimate,
  onAddSteps,
  onAddLink,
}: {
  item: ItemDTO;
  /** False while the steps' costs set the estimate, or there's a firm quote. */
  canSetEstimate: boolean;
  onEstimate: (min: number, max: number) => Undo;
  onAddSteps: (steps: Step[]) => Undo;
  onAddLink: (url: string) => Undo;
}) {
  const { jobByItem, askClaude, updateJob, addQuote, deleteQuote, settings, toast } = useStore();
  const live = jobByItem.get(item.id);
  // Used this time round: the card stays until the sheet closes, though the
  // job itself is already marked as dealt with.
  const [held, setHeld] = useState<AiJobDTO | null>(null);
  const job = live ?? held;
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Record<string, Undo>>({});
  const research = item.kind === "BUY" ? "Find options" : "Research this";

  async function ask(q?: string) {
    setBusy(true);
    const ok = await askClaude(item.id, q);
    setBusy(false);
    if (ok) {
      setQuestion("");
      setAsking(false);
      setHeld(null);
      setApplied({});
    }
  }

  function markUsed(current: AiJobDTO) {
    if (held || current.status !== "DONE") return;
    setHeld(current);
    updateJob(current, "ACCEPTED");
  }

  /** Apply a part of the answer, or take it back if it's already applied. */
  function toggle(current: AiJobDTO, key: string, apply: () => Undo | Promise<Undo | null>) {
    const undo = applied[key];
    if (undo) {
      undo();
      setApplied((a) => {
        const rest = { ...a };
        delete rest[key];
        return rest;
      });
      return;
    }
    markUsed(current);
    Promise.resolve(apply()).then((u) => u && setApplied((a) => ({ ...a, [key]: u })));
  }

  function dismiss(current: AiJobDTO) {
    const used = !!held;
    setHeld(null);
    setApplied({});
    if (used) return; // already marked as used: just put it away
    updateJob(current, "DISMISSED");
    if (current.status === "DONE") {
      toast({ message: "Suggestion dismissed", action: { label: "Undo", run: () => updateJob(current, "DONE") } });
    }
  }

  async function logQuote(option: NonNullable<AiResult["options"]>[number]): Promise<Undo | null> {
    const before = new Set(item.quotes.map((q) => q.id));
    const updated = await addQuote(item.id, {
      from: (option.retailer || option.title).slice(0, 80),
      amount: option.price!,
      note: (option.retailer ? option.title : `From Claude's research`).slice(0, 500),
    });
    const added = updated?.quotes.find((q) => !before.has(q.id));
    return added ? () => void deleteQuote(added.id) : null;
  }

  // ---- Nothing asked yet ----
  if (!job) {
    return (
      <Field label="Ask Claude" hint="Claude looks it up and suggests costs, steps and links. Nothing changes until you pick something.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => ask()}>
            <Sparkles size={16} className="text-accent-text" aria-hidden="true" /> {research}
          </Button>
          {!asking && (
            <Button variant="ghost" onClick={() => setAsking(true)}>
              Ask a question
            </Button>
          )}
        </div>
        {asking && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim()) ask(question.trim());
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={item.kind === "BUY" ? "e.g. Which lasts longer?" : "e.g. Is it cheaper to repair or replace?"}
              aria-label="Your question for Claude"
              maxLength={500}
              className={inputClass}
            />
            <Button type="submit" variant="secondary" disabled={busy || !question.trim()} aria-label="Ask Claude" className="shrink-0 px-3">
              <Send size={16} />
            </Button>
          </form>
        )}
      </Field>
    );
  }

  const asked = job.question ? (
    <p className="text-[13px] text-ink-2">
      {job.requestedBy} asked: <span className="text-ink">“{job.question}”</span>
    </p>
  ) : null;

  // ---- Waiting for a worker, or Claude working on it ----
  if (job.status === "QUEUED" || job.status === "RUNNING") {
    const worker = workerState(settings.workerSeenAt);
    const line =
      job.status === "RUNNING"
        ? "Claude's looking into it. This usually takes a minute or two."
        : worker === "active"
          ? "The worker picks it up within a minute or so."
          : worker === "away"
            ? `It runs when the worker's computer is on. Last checked in ${timeAgo(settings.workerSeenAt!)}.`
            : "No worker has checked in yet. Settings has how to set one up.";
    return (
      <Field label="Ask Claude">
        <div className="grid gap-1.5 rounded-xl border border-line py-3 pr-1.5 pl-3.5">
          {asked}
          <div className="flex items-start gap-2">
            <div role="status" className="grid min-w-0 flex-1 gap-1 pt-1">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
                {job.status === "RUNNING" ? "Claude's on it…" : "Waiting for Claude…"}
              </p>
              <p className="text-[13px] text-ink-2">{line}</p>
            </div>
            <Button variant="ghost" onClick={() => dismiss(job)} className="min-h-11 shrink-0 px-3">
              Cancel
            </Button>
          </div>
        </div>
      </Field>
    );
  }

  // ---- It didn't work ----
  if (job.status === "FAILED") {
    return (
      <Field label="Ask Claude">
        <div className="grid gap-1.5 rounded-xl border border-line px-3.5 py-3">
          {asked}
          <p className="text-[15px] font-semibold text-ink">Claude couldn&apos;t answer this time.</p>
          {job.error && <p className="text-[13px] text-ink-2">{job.error}</p>}
          <div className="-mb-1 flex justify-end gap-1">
            <Button variant="ghost" onClick={() => dismiss(job)} className="min-h-11 px-3">
              Dismiss
            </Button>
            <Button variant="secondary" onClick={() => updateJob(job, "QUEUED")} className="min-h-11">
              Try again
            </Button>
          </div>
        </div>
      </Field>
    );
  }

  // ---- The suggestion ----
  const result = job.result;
  if (!result) return null;
  const haveSteps = new Set(item.steps.map((s) => s.text.trim().toLowerCase()));
  const newSteps = (result.steps ?? []).filter((s) => !haveSteps.has(s.text.trim().toLowerCase()));
  const used = Object.keys(applied).length > 0;
  const linkAction = (url: string) => {
    const saved = item.links.includes(url) && !applied[`link:${url}`];
    return saved ? (
      <span className="inline-flex min-h-11 shrink-0 items-center px-1 text-[13px] text-ink-3">Saved</span>
    ) : (
      <CardAction done={!!applied[`link:${url}`]} onClick={() => toggle(job, `link:${url}`, () => onAddLink(url))}>
        {applied[`link:${url}`] ? "Added" : "Add link"}
      </CardAction>
    );
  };

  return (
    <Field label="Ask Claude">
      <article aria-label="Claude's suggestion" className="overflow-hidden rounded-xl border border-line">
        <div className="grid gap-2 px-3.5 pt-3 pb-3.5">
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
            <Sparkles size={13} className="text-accent-text" aria-hidden="true" />
            {job.kind === "FIND_PRODUCT" ? "Options" : job.kind === "ASK" ? "Answer" : "Research"} for {job.requestedBy}
            {job.finishedAt && <> · {timeAgo(job.finishedAt)}</>}
          </p>
          {asked}
          <p className="text-[15px] leading-snug text-ink">{result.summary}</p>
          {result.diy && <p className="text-[13px] font-semibold text-ink-2">{DIY_LABELS[result.diy]}</p>}
        </div>

        {result.estimate && (
          <section aria-label="Estimate" className="flex items-center gap-3 border-t border-line px-3.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink tabular">{formatCost(result.estimate.min, result.estimate.max)}</p>
              <p className="text-[12px] text-ink-3">Typical cost, an estimate</p>
            </div>
            {canSetEstimate && (
              <CardAction
                done={!!applied.estimate}
                onClick={() => toggle(job, "estimate", () => onEstimate(result.estimate!.min, result.estimate!.max))}
              >
                {applied.estimate ? "Using it" : "Use this estimate"}
              </CardAction>
            )}
          </section>
        )}

        {result.steps && result.steps.length > 0 && (
          <section aria-label="Suggested steps" className="grid gap-2 border-t border-line px-3.5 py-3">
            <ol className="grid gap-1.5">
              {result.steps.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[14px] text-ink">
                  <span className="w-4 shrink-0 text-[12px] text-ink-3 tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    {s.text}
                    {s.notes && <span className="block text-[12.5px] text-ink-3">{s.notes}</span>}
                  </span>
                  {s.cost != null && s.cost > 0 && <span className="shrink-0 text-[13px] text-ink-2 tabular">{formatGBP(s.cost)}</span>}
                </li>
              ))}
            </ol>
            {(newSteps.length > 0 || applied.steps) && (
              <CardAction done={!!applied.steps} onClick={() => toggle(job, "steps", () => onAddSteps(newSteps))}>
                {applied.steps
                  ? "Steps added"
                  : newSteps.length === result.steps.length
                    ? "Add these steps"
                    : `Add the ${newSteps.length} new ${newSteps.length === 1 ? "step" : "steps"}`}
              </CardAction>
            )}
          </section>
        )}

        {result.options && result.options.length > 0 && (
          <section aria-label="Options to buy" className="border-t border-line">
            <ul>
              {result.options.map((o, i) => (
                <li key={i} className="grid gap-1.5 border-b border-line px-3.5 py-2.5 last:border-b-0">
                  <div className="flex items-baseline gap-3">
                    <div className="min-w-0 flex-1">
                      {o.url ? (
                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-accent">
                          {o.title}
                        </a>
                      ) : (
                        <span className="text-[14px] font-semibold text-ink">{o.title}</span>
                      )}
                      <p className="text-[12.5px] text-ink-3">{o.retailer ?? (o.url ? linkLabel(o.url) : "")}</p>
                    </div>
                    {o.price != null && <span className="shrink-0 text-[14px] font-semibold text-ink tabular">{formatGBP(o.price)}</span>}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {o.url && linkAction(o.url)}
                    {o.price != null && (
                      <CardAction done={!!applied[`quote:${i}`]} onClick={() => toggle(job, `quote:${i}`, () => logQuote(o))}>
                        {applied[`quote:${i}`] ? "Logged" : "Log as quote"}
                      </CardAction>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.links && result.links.length > 0 && (
          <section aria-label="Useful links" className="border-t border-line">
            <ul>
              {result.links.map((l) => (
                <li key={l.url} className="flex items-center gap-2 border-b border-line py-1 pr-3.5 pl-3.5 last:border-b-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-[14px] text-ink hover:text-accent-text"
                  >
                    <ExternalLink size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate">{l.title}</span>
                      <span className="block truncate text-[12px] text-ink-3">{linkLabel(l.url)}</span>
                    </span>
                  </a>
                  {linkAction(l.url)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {result.cautions && result.cautions.length > 0 && (
          <section aria-label="Watch out for" className="grid gap-1.5 border-t border-line px-3.5 py-3">
            <p className="text-[12.5px] font-semibold text-ink-2">Watch out for</p>
            <ul className="grid gap-1.5">
              {result.cautions.map((c, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-snug text-ink">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex items-center gap-1 border-t border-line bg-sunken/50 px-2 py-1">
          <p className="min-w-0 flex-1 px-1.5 text-[12px] text-ink-3">
            {used ? "Added to this item. It saves when you close." : "From Claude. Check prices before you buy."}
          </p>
          <Button variant="ghost" onClick={() => dismiss(job)} className="min-h-11 shrink-0 px-3">
            {used ? (
              "Done"
            ) : (
              <>
                <X size={15} aria-hidden="true" /> Dismiss
              </>
            )}
          </Button>
        </div>
      </article>
    </Field>
  );
}
