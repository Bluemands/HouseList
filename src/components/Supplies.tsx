"use client";

import { Link2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ItemDTO, StepDTO } from "@/lib/types";
import { formatGBP, linkLabel } from "@/lib/format";
import { PaintChip } from "@/components/ui";

export type Supply = { item: ItemDTO; step: StepDTO };

/**
 * Things to buy that live inside jobs ("Buy socket faceplates" under "Fit
 * new sockets"), so one trip to the shop covers the lot. Ticking one ticks
 * its step — and pays that stage from the pot.
 */
export function Supplies({ supplies }: { supplies: Supply[] }) {
  const { toggleStep, openItem } = useStore();
  if (!supplies.length) return null;
  const total = supplies.reduce((sum, s) => sum + (s.step.cost ?? 0), 0);

  return (
    <section aria-labelledby="supplies-head">
      <h2
        id="supplies-head"
        className="sticky top-[104px] z-[15] -mx-1 flex items-center justify-between bg-bg px-1 py-2 text-[14px] font-bold text-ink"
      >
        For jobs
        <span className="text-[13px] font-medium text-ink-3 tabular">
          {supplies.length}
          {total > 0 && <> · {formatGBP(total)}</>}
        </span>
      </h2>
      <ul className="border-t border-line">
        {supplies.map(({ item, step }) => (
          <li key={step.id} className="flex items-start gap-3 border-b border-line px-1 py-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              aria-label={`Got “${step.text}” for “${item.title}”`}
              onClick={() => toggleStep(item, step.id)}
              className="group/tick -m-[9px] grid shrink-0 place-items-center p-[9px]"
            >
              <span className="h-[26px] w-[26px] rounded-[8px] border-[1.5px] border-line-strong transition-colors group-hover/tick:border-accent group-hover/tick:bg-accent-soft" />
            </button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => openItem(item.id)} className="block w-full text-left">
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-ink">{step.text}</span>
                  {step.cost != null && step.cost > 0 && (
                    <span className="shrink-0 pt-px text-[14px] font-medium text-ink tabular">{formatGBP(step.cost)}</span>
                  )}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
                  <PaintChip room={item.room} />
                  <span className="truncate">For {item.title}</span>
                </span>
              </button>
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline"
                >
                  <Link2 size={13} /> {linkLabel(step.link)}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
