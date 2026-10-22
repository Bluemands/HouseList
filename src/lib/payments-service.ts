import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { paymentCreateSchema, paymentUpdateSchema } from "@/lib/validation";
import { fromDay, toPaymentDTO } from "@/lib/data";

// Money owed between the two of you (lib/payments.ts has the sums). Kept
// apart from the pot on purpose: nothing here moves it.

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function createPayment(data: z.output<typeof paymentCreateSchema>) {
  // Split from something on the list that's since been deleted: logged all the same.
  const itemId = data.itemId && (await prisma.item.count({ where: { id: data.itemId } })) ? data.itemId : null;
  const payment = await prisma.payment.create({
    data: { ...data, itemId, billTotal: data.billTotal ?? null, billedOn: fromDay(data.billedOn)! },
  });
  return toPaymentDTO(payment);
}

/** The payment as it is now, or null if it's gone. */
export async function updatePayment(id: string, data: z.output<typeof paymentUpdateSchema>) {
  const before = await prisma.payment.findUnique({ where: { id } });
  if (!before) return null;
  const { actor, paidOn, billedOn, ...rest } = data;
  const owedBy = rest.owedBy ?? before.owedBy;
  const owedTo = rest.owedTo ?? before.owedTo;
  if (owedBy.toLowerCase() === owedTo.toLowerCase()) throw new PaymentError("Pick who owes whom");
  const amount = rest.amount ?? before.amount;
  const billTotal = rest.billTotal === undefined ? before.billTotal : rest.billTotal;
  if (billTotal != null && amount > billTotal) throw new PaymentError("That's more than the whole bill");

  const paid: { paidOn?: Date | null; paidBy?: string | null; settlementId?: string | null } = {};
  const wasPaidOn = before.paidOn?.toISOString().slice(0, 10) ?? null;
  if (paidOn !== undefined && paidOn !== wasPaidOn) {
    paid.paidOn = fromDay(paidOn);
    // Who ticked it stays who ticked it when only the date moves.
    paid.paidBy = paidOn === null ? null : (before.paidBy ?? actor);
    // On another day than the rest of its settle-up, it's a payment of its own.
    paid.settlementId = null;
  }
  const payment = await prisma.payment.update({
    where: { id },
    data: { ...rest, ...(billedOn !== undefined && { billedOn: fromDay(billedOn)! }), ...paid },
  });
  return { payment: toPaymentDTO(payment), justPaid: !wasPaidOn && !!payment.paidOn };
}

export async function deletePayment(id: string) {
  // deleteMany so both phones deleting it at once is a no-op.
  await prisma.payment.deleteMany({ where: { id } });
}

/**
 * Ticks off every one of `ids` still open, as one settle-up on `paidOn`; any
 * the other phone ticked off meanwhile are left as they are. With `paidOn`
 * null, reopens them instead (undoing a settle-up). Answers with the payments
 * as they now are, and the settle-up's id.
 */
export async function settlePayments(ids: string[], paidOn: string | null, actor: string) {
  let settlementId: string | null = null;
  if (paidOn === null) {
    await prisma.payment.updateMany({ where: { id: { in: ids } }, data: { paidOn: null, paidBy: null, settlementId: null } });
  } else {
    settlementId = randomUUID();
    await prisma.payment.updateMany({
      where: { id: { in: ids }, paidOn: null },
      data: { paidOn: fromDay(paidOn), paidBy: actor, settlementId },
    });
  }
  const payments = await prisma.payment.findMany({ where: { id: { in: ids } } });
  return { payments: payments.map(toPaymentDTO), settlementId };
}

/** Moves a whole settle-up to the day it was really paid. */
export async function redateSettlement(settlementId: string, paidOn: string) {
  await prisma.payment.updateMany({ where: { settlementId }, data: { paidOn: fromDay(paidOn) } });
  const payments = await prisma.payment.findMany({ where: { settlementId } });
  return payments.map(toPaymentDTO);
}

export async function getPayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  return payment ? toPaymentDTO(payment) : null;
}
