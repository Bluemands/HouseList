"use client";

import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { PRIORITY_LABELS, REPEAT_LABELS, STATUS_LABELS, type ItemDTO } from "@/lib/types";
import { describeDue, formatCost, formatDay, formatGBP, linkLabel } from "@/lib/format";
import { useStore } from "@/lib/store";
import { stepLines } from "@/lib/printouts";
import { Field, RoomTag } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { PlanNote } from "@/components/PlanNote";
import { PhotosField } from "@/components/Photos";
import { QuotesField, UpdatesField } from "@/components/ItemExtras";

/*
 * An item as it stands, to read. Opening one lands here, so a stray tap
 * changes nothing; Edit swaps in the form. Ticking a step, adding a photo and
 * posting an update still work here, since they're often why it was opened.
 * Split in two around the Claude card, which the sheet keeps in one place
 * across reading and editing.
 */

/** The title, the facts, where it sits in the plan, and its steps. */
export function ItemFacts({ item, planned }: { item: ItemDTO; planned: ItemDTO }) {
  const { toggleStep } = useStore();
  const done = item.status === "DONE";
  const due = item.dueDate && !done ? describeDue(item.dueDate) : null;
  const cost = done && item.actualPrice != null ? formatGBP(item.actualPrice) : formatCost(item.estimatedPrice, item.estimateMax);

  const facts: [string, React.ReactNode][] = [
    ["Status", STATUS_LABELS[item.kind][item.status]],
    ["Priority", PRIORITY_LABELS[item.priority]],
    ["Room", <RoomTag key="room" room={item.room} />],
  ];
  if (cost) facts.push(["Cost", `${cost}${done && item.actualPrice != null ? " paid" : item.isQuote ? " · firm quote" : ""}`]);
  if (item.assignee) facts.push(["Who's on it", item.assignee]);
  if (due) {
    facts.push([
      "When",
      <span key="due" className={clsx(due.tone === "overdue" && "font-semibold text-danger")}>
        {due.label}
      </span>,
    ]);
  }
  if (item.repeat) facts.push(["Repeats", REPEAT_LABELS[item.repeat]]);
  if (item.warrantyUntil) facts.push(["Guaranteed until", formatDay(item.warrantyUntil)]);
  if (item.project) facts.push(["Project", item.project]);

  return (
    <div className="grid gap-5">
      <h2 className="py-2 text-sheet-title leading-tight font-bold tracking-[-0.015em] text-ink">{item.title}</h2>

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2.5">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-meta font-semibold text-ink-2">{label}</dt>
            <dd className="text-body text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <PlanNote planned={planned} isNew={false} />

      {item.steps.length > 0 && (
        <Field label="Steps">
          <ul className="overflow-hidden rounded-xl border border-line">
            {item.steps.map((step) => {
              const link = step.link;
              return (
                <li key={step.id} className="border-b border-line last:border-b-0">
                  <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={step.done}
                      onChange={() => toggleStep(item, step.id)}
                      aria-label={`Step done: ${step.text}`}
                      className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={clsx("text-body", step.done ? "text-ink-3 line-through" : "text-ink")}>{step.text}</span>
                      {step.notes && <span className="mt-0.5 block text-meta text-ink-2">{step.notes}</span>}
                    </span>
                    {step.cost != null && (
                      <span className="shrink-0 text-supporting text-ink-2 tabular">{formatGBP(step.cost)}</span>
                    )}
                  </label>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="-mt-1.5 mb-2 ml-[2.4rem] inline-flex items-center gap-1 text-meta font-medium text-accent-text hover:underline"
                    >
                      {linkLabel(link)}
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {item.steps.some((st) => !st.done) && (
            <PrintButton
              title={item.title}
              lines={() => stepLines(item)}
              label="Print the steps"
              className="-ml-3 justify-self-start"
            />
          )}
        </Field>
      )}
    </div>
  );
}

/** Notes, photos, quotes, updates and links: each only once it has something, bar photos. */
export function ItemDetails({ item }: { item: ItemDTO }) {
  return (
    <div className="grid gap-5">
      {item.notes && (
        <Field label="Notes">
          <p className="text-body leading-snug whitespace-pre-wrap text-ink">{item.notes}</p>
        </Field>
      )}

      <Field label="Photos">
        <PhotosField item={item} />
      </Field>

      {item.quotes.length > 0 && <QuotesField item={item} readOnly />}

      {item.comments.length > 0 && <UpdatesField item={item} />}

      {item.links.length > 0 && (
        <Field label="Links">
          <ul className="grid gap-1.5">
            {item.links.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-body font-medium text-accent-text hover:underline"
                >
                  {linkLabel(url)}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}
