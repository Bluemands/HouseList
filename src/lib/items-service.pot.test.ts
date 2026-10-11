import { beforeEach, describe, expect, it, vi } from "vitest";

// The write path's pot arithmetic, against a stand-in for the database that
// records what would be written.
const db = vi.hoisted(() => ({
  settings: { id: 1, budgetAvailable: 1000, potTracked: true, monthlySaving: 0, members: ["Connor"] },
  potMoves: [] as number[],
  created: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/prisma", () => {
  let seq = 0;
  const tx = {
    item: {
      create: async ({ data }: { data: Record<string, unknown> & { steps?: { create: Record<string, unknown>[] } } }) => {
        seq += 1;
        const now = new Date();
        const steps = (data.steps?.create ?? []).map((s, i) => ({ id: `s${seq}-${i}`, ...s }));
        const row = {
          isQuote: false,
          estimatedPrice: null,
          estimateMax: null,
          actualPrice: null,
          potCharge: null,
          completedAt: null,
          completedBy: null,
          links: [],
          ...data,
          id: `i${seq}`,
          steps,
          quotes: [],
          comments: [],
          dueDate: null,
          warrantyUntil: null,
          createdAt: (data.createdAt as Date | undefined) ?? now,
          updatedAt: now,
        };
        db.created.push(row);
        return row;
      },
    },
    settings: {
      update: async ({ data }: { data: { budgetAvailable?: { increment: number } } }) => {
        if (data.budgetAvailable) db.potMoves.push(data.budgetAvailable.increment);
        return db.settings;
      },
    },
  };
  return {
    prisma: {
      settings: { upsert: async () => db.settings },
      $transaction: async (work: (t: typeof tx) => Promise<unknown>) => work(tx),
    },
  };
});

const { createItem, createItems } = await import("@/lib/items-service");

beforeEach(() => {
  db.potMoves = [];
  db.created = [];
});

const total = () => db.potMoves.reduce((sum, n) => sum + n, 0);

describe("adding items with stages already paid", () => {
  const steps = [
    { text: "Deposit", cost: 200, done: true },
    { text: "Balance", cost: 800 },
  ];

  it("one at a time, takes the paid stage from the pot", async () => {
    const item = await createItem({ title: "Kitchen refit", addedBy: "Connor", steps });
    expect(total()).toBe(-200);
    expect(item.steps[0]).toMatchObject({ done: true, potCharge: 200 });
  });

  it("several at once (as Claude adds them), the same", async () => {
    const [item] = await createItems({ addedBy: "Claude", items: [{ title: "Kitchen refit", steps }] }, { addMember: false });
    expect(total()).toBe(-200);
    expect(item.steps[0]).toMatchObject({ done: true, potCharge: 200 });
    expect(item.steps[0].doneAt).not.toBeNull();
  });
});
