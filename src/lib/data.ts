import { prisma } from "@/lib/prisma";
import type { Comment, Item, Quote, Settings, Step } from "@/generated/prisma/client";
import { stepsTotal, type ItemDTO, type SettingsDTO } from "@/lib/types";

const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function fromDay(day: string | null | undefined): Date | null | undefined {
  if (day === undefined) return undefined;
  return day === null ? null : new Date(`${day}T00:00:00.000Z`);
}

type StepInput = { text: string; done?: boolean; cost?: number | null; link?: string | null; notes?: string | null };

/** A list of steps as rows to create, in the order given. */
export function stepRows(steps: StepInput[]) {
  return steps.map((s, position) => ({
    text: s.text,
    done: s.done ?? false,
    cost: s.cost ?? null,
    link: s.link ?? null,
    notes: s.notes ?? null,
    position,
  }));
}

/** When steps carry costs, the item's estimate is their total. */
export function estimateFromSteps(steps: StepInput[] | undefined) {
  const total = steps ? stepsTotal(steps) : null;
  return total == null ? {} : { estimatedPrice: total, estimateMax: null };
}

/** Everything an item carries, for every query that returns one. */
export const ITEM_INCLUDE = { steps: true, quotes: true, comments: true } as const;

type FullItem = Item & { steps: Step[]; quotes?: Quote[]; comments?: Comment[] };

export function toItemDTO(item: FullItem): ItemDTO {
  const { quotes = [], comments = [], ...rest } = item;
  return {
    ...rest,
    dueDate: toDay(item.dueDate),
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    steps: [...item.steps]
      .sort((a, b) => a.position - b.position)
      .map(({ id, text, done, cost, link, notes }) => ({ id, text, done, cost, link, notes })),
    quotes: [...quotes]
      .sort((a, b) => a.amount - b.amount)
      .map(({ id, from, amount, note, chosen, addedBy, createdAt }) => ({
        id,
        from,
        amount,
        note,
        chosen,
        addedBy,
        createdAt: createdAt.toISOString(),
      })),
    comments: [...comments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ id, author, text, createdAt }) => ({ id, author, text, createdAt: createdAt.toISOString() })),
  };
}

export function toSettingsDTO(settings: Settings): SettingsDTO {
  return {
    budgetAvailable: settings.budgetAvailable,
    potTracked: settings.potTracked,
    monthlySaving: settings.monthlySaving,
    members: settings.members ?? [],
    movedInOn: toDay(settings.movedInOn),
    lastPaydayOn: toDay(settings.lastPaydayOn),
    lastPaydayBy: settings.lastPaydayBy,
  };
}

export function getSettings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function getState(): Promise<{ items: ItemDTO[]; settings: SettingsDTO }> {
  // Sequential, not Promise.all: concurrent queries over the same adapter
  // pool have triggered "prepared statement" protocol errors against the
  // local Prisma Postgres dev server.
  const items = await prisma.item.findMany({ include: ITEM_INCLUDE, orderBy: { createdAt: "desc" } });
  const settings = await getSettings();
  return { items: items.map(toItemDTO), settings: toSettingsDTO(settings) };
}
