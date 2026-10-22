import { NextRequest, NextResponse } from "next/server";
import { settlementUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { redateSettlement } from "@/lib/payments-service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/payments/settlements/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, settlementUpdateSchema);
  if ("error" in body) return body.error;
  return NextResponse.json({ payments: await redateSettlement(id, body.data.paidOn) });
}
