import { beforeEach, describe, expect, it, vi } from "vitest";

// The paid-date rules on the write path, against a stand-in for the database.
type Row = Record<string, unknown> & { id: string };
const db = vi.hoisted(() => ({ rows: new Map<string, Row>(), updateManyWhere: [] as unknown[] }));

vi.mock("@/lib/prisma", () => {
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === "object" && "in" in (v as object) ? (v as { in: unknown[] }).in.includes(row[k]) : row[k] === v,
    );
  return {
    prisma: {
      payment: {
        findUnique: async ({ where }: { where: { id: string } }) => db.rows.get(where.id) ?? null,
        findMany: async ({ where }: { where: Record<string, unknown> }) => [...db.rows.values()].filter((r) => matches(r, where)),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = { ...db.rows.get(where.id)!, ...data };
          db.rows.set(where.id, row);
          return row;
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          db.updateManyWhere.push(where);
          let count = 0;
          for (const row of db.rows.values()) {
            if (!matches(row, where)) continue;
            db.rows.set(row.id, { ...row, ...data });
            count += 1;
          }
          return { count };
        },
      },
    },
  };
});

const { settlePayments, updatePayment, PaymentError } = await import("@/lib/payments-service");

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function row(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    description: "Council tax",
    amount: 85,
    billTotal: 170,
    owedBy: "Kerry",
    owedTo: "Connor",
    billedOn: day("2026-10-01"),
    paidOn: null,
    paidBy: null,
    settlementId: null,
    itemId: null,
    addedBy: "Connor",
    createdAt: new Date("2026-10-01T09:00:00Z"),
    updatedAt: new Date("2026-10-01T09:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  db.rows.clear();
  db.updateManyWhere = [];
});

describe("updatePayment", () => {
  it("ticking off records who and when", async () => {
    db.rows.set("a", row("a"));
    const result = await updatePayment("a", { paidOn: "2026-10-20", actor: "Kerry" });
    expect(result?.justPaid).toBe(true);
    expect(result?.payment).toMatchObject({ paidOn: "2026-10-20", paidBy: "Kerry", settlementId: null });
  });

  it("moving the paid date keeps who ticked it, and takes it out of its settle-up", async () => {
    db.rows.set("a", row("a", { paidOn: day("2026-10-20"), paidBy: "Kerry", settlementId: "s" }));
    const result = await updatePayment("a", { paidOn: "2026-10-18", actor: "Connor" });
    expect(result?.justPaid).toBe(false);
    expect(result?.payment).toMatchObject({ paidOn: "2026-10-18", paidBy: "Kerry", settlementId: null });
  });

  it("leaves a settle-up alone when the date doesn't change", async () => {
    db.rows.set("a", row("a", { paidOn: day("2026-10-20"), paidBy: "Kerry", settlementId: "s" }));
    const result = await updatePayment("a", { paidOn: "2026-10-20", description: "Council tax, Oct", actor: "Connor" });
    expect(result?.payment).toMatchObject({ settlementId: "s", description: "Council tax, Oct" });
  });

  it("not paid after all clears it", async () => {
    db.rows.set("a", row("a", { paidOn: day("2026-10-20"), paidBy: "Kerry", settlementId: "s" }));
    const result = await updatePayment("a", { paidOn: null, actor: "Connor" });
    expect(result?.payment).toMatchObject({ paidOn: null, paidBy: null, settlementId: null });
  });

  it("won't have someone owe themselves", async () => {
    db.rows.set("a", row("a"));
    await expect(updatePayment("a", { owedTo: "kerry", actor: "Kerry" })).rejects.toBeInstanceOf(PaymentError);
  });

  it("is null for one that's gone", async () => {
    expect(await updatePayment("nope", { paidOn: null, actor: "Connor" })).toBeNull();
  });
});

describe("settlePayments", () => {
  it("ticks off only what's still open, under one settle-up", async () => {
    db.rows.set("a", row("a"));
    db.rows.set("b", row("b", { owedBy: "Connor", owedTo: "Kerry", amount: 5 }));
    db.rows.set("c", row("c", { paidOn: day("2026-10-02"), paidBy: "Kerry" }));
    const { payments, settlementId } = await settlePayments(["a", "b", "c"], "2026-10-21", "Connor");
    expect(settlementId).toBeTruthy();
    const byId = Object.fromEntries(payments.map((p) => [p.id, p]));
    expect(byId.a).toMatchObject({ paidOn: "2026-10-21", paidBy: "Connor", settlementId });
    expect(byId.b).toMatchObject({ paidOn: "2026-10-21", settlementId });
    // Ticked off on the other phone first: left as it was.
    expect(byId.c).toMatchObject({ paidOn: "2026-10-02", paidBy: "Kerry", settlementId: null });
  });

  it("reopens them all when undone", async () => {
    db.rows.set("a", row("a", { paidOn: day("2026-10-21"), paidBy: "Connor", settlementId: "s" }));
    const { payments, settlementId } = await settlePayments(["a"], null, "Connor");
    expect(settlementId).toBeNull();
    expect(payments[0]).toMatchObject({ paidOn: null, paidBy: null, settlementId: null });
  });
});
