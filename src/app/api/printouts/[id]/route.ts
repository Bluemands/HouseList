import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPrintOut } from "@/lib/printouts-server";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/printouts/[id]">) {
  const { id } = await ctx.params;
  const printOut = await getPrintOut(id);
  if (!printOut) return NextResponse.json({ error: "That print-out has gone (they're kept for a month)" }, { status: 404 });
  return NextResponse.json({ printOut });
}

// Thrown away without ticking anything off (a test, or a list gone stale).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/printouts/[id]">) {
  const { id } = await ctx.params;
  await prisma.printOut.deleteMany({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
