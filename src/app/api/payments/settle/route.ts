import { NextRequest, NextResponse } from "next/server";
import { paymentSettleSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { getPayment, settlePayments } from "@/lib/payments-service";
import { notifySettled } from "@/lib/payments-push";
import { net } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, paymentSettleSchema);
  if ("error" in parsed) return parsed.error;
  const { ids, paidOn, actor } = parsed.data;
  const result = await settlePayments(ids, paidOn, actor);
  const settled = result.payments.filter((p) => p.settlementId && p.settlementId === result.settlementId);
  if (settled.length) {
    notifySettled(settled, net(settled), actor, async () => (await getPayment(settled[0].id))?.settlementId === result.settlementId);
  }
  return NextResponse.json(result);
}
