import { NextRequest, NextResponse } from "next/server";
import { paymentUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { PaymentError, deletePayment, getPayment, updatePayment } from "@/lib/payments-service";
import { notifyPaid } from "@/lib/payments-push";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/payments/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, paymentUpdateSchema);
  if ("error" in body) return body.error;
  try {
    const result = await updatePayment(id, body.data);
    if (!result) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
    if (result.justPaid) notifyPaid(result.payment, body.data.actor, async () => !!(await getPayment(id))?.paidOn);
    return NextResponse.json({ payment: result.payment });
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/payments/[id]">) {
  const { id } = await ctx.params;
  await deletePayment(id);
  return NextResponse.json({ ok: true });
}
