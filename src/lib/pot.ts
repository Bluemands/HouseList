// The pot's rules, shared by the server (which keeps the books) and the
// client (which shows the result before the server answers):
//  - Once the pot is in use, ticking a costed step spends its cost (a stage
//    payment), and unticking it puts it back.
//  - Finishing an item spends what's left: its price less the steps done.
//  - Anything ticked off before the pot was in use never touches it.
// A charge of null means "not charged"; 0 means "charged nothing".

type Status = "TODO" | "DOING" | "DONE";
type StepBefore = { id: string; done: boolean; cost: number | null; potCharge: number | null };
type StepAfter = { id?: string; done?: boolean; cost?: number | null };

/**
 * The range to ask about when something's ticked off without a known price:
 * a guess with a top higher than its bottom ("£100–150"), or only a top
 * ("up to £150", min null). Finishing assumes the bottom (nothing, for "up
 * to"), so this is when asking what it really cost is worth a question.
 */
export function costToConfirm(item: {
  estimatedPrice: number | null;
  estimateMax: number | null;
  actualPrice: number | null;
}): { min: number | null; max: number } | null {
  const { estimatedPrice: min, estimateMax: max, actualPrice } = item;
  if (actualPrice != null || max == null || (min != null && max <= min)) return null;
  return { min, max };
}

/** What the done steps cost, paid or not. */
export function doneStepsCost(steps: { done?: boolean; cost?: number | null }[]): number {
  return steps.reduce((sum, s) => sum + (s.done ? (s.cost ?? 0) : 0), 0);
}

function stepCharge(before: StepBefore | undefined, after: StepAfter, tracked: boolean): number | null {
  if (!after.done) return null;
  const charged = before?.done ? before.potCharge != null : tracked;
  return charged ? (after.cost ?? 0) : null;
}

/**
 * The charges after a change, and how much the pot moves (negative = spent).
 * `after.steps` is the full new list when steps changed, or undefined.
 * Deleting a paid step doesn't refund it — the money was still spent.
 */
export function settlePot(
  before: { status: Status; potCharge: number | null; steps: StepBefore[] },
  after: { status: Status; actualPrice: number | null; steps?: StepAfter[] },
  tracked: boolean,
) {
  const stepCharges = after.steps?.map((s) =>
    stepCharge(before.steps.find((b) => b.id === s.id), s, tracked),
  );
  const steps = after.steps ?? before.steps;

  let itemCharge: number | null = null;
  if (after.status === "DONE") {
    const charged = before.status === "DONE" ? before.potCharge != null : tracked;
    if (charged) itemCharge = Math.max(0, (after.actualPrice ?? 0) - doneStepsCost(steps));
  }

  const kept = after.steps
    ? before.steps.filter((b) => after.steps!.some((s) => s.id === b.id))
    : before.steps;
  const was = (before.potCharge ?? 0) + kept.reduce((sum, s) => sum + (s.potCharge ?? 0), 0);
  const now =
    (itemCharge ?? 0) +
    (stepCharges ? stepCharges.reduce<number>((sum, c) => sum + (c ?? 0), 0) : was - (before.potCharge ?? 0));
  return { itemCharge, stepCharges, delta: was - now };
}
