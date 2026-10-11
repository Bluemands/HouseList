"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { planImpact, type PlanMove } from "@/lib/plan";
import type { ItemDTO } from "@/lib/types";
import { formatGBP, formatMonth } from "@/lib/format";
import { Field, Suggestion } from "@/components/ui";

/** "now", "Apr 2027", or "not at current savings". */
function when(months: number | null, long = false) {
  if (months === 0) return "now";
  if (months === null) return "not at current savings";
  return formatMonth(months, long);
}

/** “Sofa” (to Apr 2027), “Sofa” (to Apr 2027) and 2 more. Quoted, as titles can have commas. */
function names(moves: PlanMove[]) {
  const [first, ...rest] = moves;
  const title = first.item.title.length > 40 ? `${first.item.title.slice(0, 38).trimEnd()}…` : first.item.title;
  const lead = `“${title}” (to ${when(first.to)})`;
  return rest.length ? `${lead} and ${rest.length} more` : lead;
}

/**
 * Where the item sits in the plan, worked out from the sheet as it stands, so
 * changing its priority or cost shows what that does before it's saved: when
 * it becomes affordable, and what it pushes back or brings forward. When
 * pinning it would make it affordable now, that's one tap.
 */
export function PlanNote({ planned, isNew }: { planned: ItemDTO; isNew: boolean }) {
  const { items, settings, patchItem } = useStore();
  const impact = useMemo(() => planImpact(items, settings, planned), [items, settings, planned]);
  const pinning = useMemo(
    () =>
      !isNew && !planned.pinned && impact.after?.monthsAway !== 0
        ? planImpact(items, settings, { ...planned, pinned: true })
        : null,
    [isNew, planned, impact, items, settings],
  );
  const { before, after, later, sooner } = impact;
  // Until the pot is set up, nothing is "not affordable"; free and finished things aren't in the plan.
  if (!settings.potTracked || !after) return null;

  const ahead = after.ahead === 1 ? "the 1 thing ahead of it" : `the ${after.ahead} things ahead of it`;
  let status: string;
  let detail: string;
  if (after.monthsAway === 0) {
    status = "Affordable now";
    detail = `${formatGBP(after.spare)} left in the pot after it${after.ahead ? ` and ${ahead}` : ""}.`;
  } else {
    status = after.monthsAway === null ? "Not affordable yet" : `Affordable from ${when(after.monthsAway, true)}`;
    detail = `${formatGBP(after.short)} short today${after.ahead ? `, counting ${ahead}` : ""}${
      after.monthsAway === null ? ". Set a monthly saving under Money to see when." : "."
    }`;
  }

  // What this edit changes, against the item as saved (or the list without it, if new).
  const effects: string[] = [];
  if (before && before.monthsAway !== after.monthsAway) {
    const forward = (after.monthsAway ?? Infinity) < (before.monthsAway ?? Infinity);
    effects.push(`moves it ${forward ? "forward" : "back"} from ${when(before.monthsAway)}`);
  }
  if (later.length) effects.push(`pushes back ${names(later)}`);
  if (sooner.length) effects.push(`brings forward ${names(sooner)}`);
  const change = effects.length ? `${isNew ? "Adding it" : "This change"} ${effects.join(", and ")}.` : null;

  const pinFits = pinning?.after?.monthsAway === 0 ? pinning : null;

  return (
    <Field label="The plan">
      <div className="grid gap-1" aria-live="polite">
        <span className="text-[15px] font-semibold text-ink tabular">{status}</span>
        <span className="text-[13px] text-ink-2 tabular">{detail}</span>
        {change && <span className="text-[13px] font-medium text-ink tabular">{change}</span>}
      </div>
      {pinFits && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Suggestion onClick={() => patchItem(planned.id, { pinned: true })}>Pin it to afford it now</Suggestion>
          {pinFits.later.length > 0 && (
            <span className="text-[12px] text-ink-3 tabular">Pushes back {names(pinFits.later)}.</span>
          )}
        </div>
      )}
    </Field>
  );
}
