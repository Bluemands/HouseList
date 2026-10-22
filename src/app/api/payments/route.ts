import { NextRequest, NextResponse } from "next/server";
import { paymentCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createPayment } from "@/lib/payments-service";
import { notifyLogged } from "@/lib/payments-push";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, paymentCreateSchema);
  if ("error" in parsed) return parsed.error;
  const payment = await createPayment(parsed.data);
  notifyLogged(payment);
  return NextResponse.json({ payment }, { status: 201 });
}
