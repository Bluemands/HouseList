import { describe, expect, it } from "vitest";
import { balances, clearedIn, half, history, net, owesLine, paidLine, recentDescriptions, type PaymentDTO } from "@/lib/payments";

let seq = 0;
function payment(over: Partial<PaymentDTO> = {}): PaymentDTO {
  seq += 1;
  return {
    id: `p${seq}`,
    description: `Bill ${seq}`,
    amount: 10,
    billTotal: null,
    owedBy: "Kerry",
    owedTo: "Connor",
    billedOn: "2026-10-01",
    paidOn: null,
    paidBy: null,
    settlementId: null,
    addedBy: "Connor",
    createdAt: `2026-10-01T10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    ...over,
  };
}

describe("half", () => {
  it("rounds to the penny", () => {
    expect(half(170)).toBe(85);
    expect(half(85.01)).toBe(42.51);
    expect(half(0.03)).toBe(0.02);
  });
});

describe("net", () => {
  it("nets both ways into one payment", () => {
    const n = net([
      payment({ amount: 85 }),
      payment({ amount: 42.5 }),
      payment({ owedBy: "Connor", owedTo: "Kerry", amount: 20 }),
    ]);
    expect(n).toEqual({ from: "Kerry", to: "Connor", amount: 107.5 });
  });

  it("can come out the other way", () => {
    const n = net([payment({ amount: 5 }), payment({ owedBy: "Connor", owedTo: "Kerry", amount: 30 })]);
    expect(n).toEqual({ from: "Connor", to: "Kerry", amount: 25 });
  });

  it("is even when it cancels out, without float dust", () => {
    const n = net([
      payment({ amount: 0.1 }),
      payment({ amount: 0.2 }),
      payment({ owedBy: "Connor", owedTo: "Kerry", amount: 0.3 }),
    ]);
    expect(n).toEqual({ from: null, to: null, amount: 0 });
  });
});

describe("balances", () => {
  it("only counts what's still open, oldest bill first", () => {
    const later = payment({ billedOn: "2026-10-09", amount: 40 });
    const earlier = payment({ billedOn: "2026-10-02", amount: 10 });
    const paid = payment({ amount: 500, paidOn: "2026-10-05" });
    const [b] = balances([later, paid, earlier]);
    expect(b.amount).toBe(50);
    expect(b.open.map((p) => p.id)).toEqual([earlier.id, later.id]);
  });

  it("keeps each pair of people apart", () => {
    const out = balances([payment(), payment({ owedBy: "Sam", owedTo: "Connor" }), payment({ owedBy: "Connor", owedTo: "Kerry" })]);
    expect(out).toHaveLength(2);
    expect(out.find((b) => b.people.includes("Sam"))?.amount).toBe(10);
    expect(out.find((b) => b.people.includes("Kerry"))?.amount).toBe(0);
  });

  it("is empty when everything's paid", () => {
    expect(balances([payment({ paidOn: "2026-10-03" })])).toEqual([]);
  });
});

describe("history", () => {
  it("shows a settle-up as one entry, newest first", () => {
    const single = payment({ paidOn: "2026-10-20", amount: 12 });
    const s1 = payment({ paidOn: "2026-10-21", settlementId: "s", amount: 85 });
    const s2 = payment({ paidOn: "2026-10-21", settlementId: "s", owedBy: "Connor", owedTo: "Kerry", amount: 5 });
    const open = payment();
    const out = history([single, s1, open, s2]);
    expect(out.map((e) => e.key)).toEqual(["s", single.id]);
    expect(out[0]).toMatchObject({ settlementId: "s", from: "Kerry", to: "Connor", amount: 80 });
    expect(out[0].payments).toHaveLength(2);
    expect(out[1]).toMatchObject({ settlementId: null, from: "Kerry", to: "Connor", amount: 12 });
  });

  it("treats what's left of a reopened settle-up as a payment of its own", () => {
    const [e] = history([payment({ paidOn: "2026-10-21", settlementId: "s", amount: 85 })]);
    expect(e.settlementId).toBeNull();
    expect(e.amount).toBe(85);
  });
});

describe("clearedIn", () => {
  it("adds up what was paid in the year, by who owed whom", () => {
    const out = clearedIn(
      [
        payment({ amount: 85, paidOn: "2026-02-01" }),
        payment({ amount: 15.5, paidOn: "2026-10-01" }),
        payment({ amount: 999, paidOn: "2025-12-31" }),
        payment({ amount: 7 }),
        payment({ owedBy: "Connor", owedTo: "Kerry", amount: 4, paidOn: "2026-03-01" }),
      ],
      "2026",
    );
    expect(out).toEqual([
      { owedBy: "Kerry", owedTo: "Connor", amount: 100.5 },
      { owedBy: "Connor", owedTo: "Kerry", amount: 4 },
    ]);
  });
});

describe("recentDescriptions", () => {
  it("offers each bill once, newest first", () => {
    const out = recentDescriptions([
      payment({ description: "Council tax", createdAt: "2026-09-01T00:00:00Z", amount: 80 }),
      payment({ description: "council tax", createdAt: "2026-10-01T00:00:00Z", amount: 85, billTotal: 170 }),
      payment({ description: "Broadband", createdAt: "2026-09-15T00:00:00Z" }),
    ]);
    expect(out.map((r) => r.description)).toEqual(["council tax", "Broadband"]);
    expect(out[0].billTotal).toBe(170);
  });
});

describe("wording", () => {
  it("speaks from where you stand", () => {
    expect(owesLine("Kerry", "Connor", "Connor")).toBe("Kerry owes you");
    expect(owesLine("Kerry", "Connor", "Kerry")).toBe("You owe Connor");
    expect(owesLine("Kerry", "Connor", "Sam")).toBe("Kerry owes Connor");
    expect(paidLine("Kerry", "Connor", "Connor")).toBe("Kerry paid you");
  });
});
