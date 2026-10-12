import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/api-route";
import { PRINT_OUT_DAYS, type PrintLine, type PrintOutSummary } from "@/lib/printouts";
import { printOutCreateSchema } from "@/lib/validation";

const cutoff = () => new Date(Date.now() - PRINT_OUT_DAYS * 24 * 60 * 60 * 1000);

// A list about to be printed: kept as it is, so it can be ticked back in.
export async function POST(request: NextRequest) {
  const body = await readBody(request, printOutCreateSchema);
  if ("error" in body) return body.error;
  const { title, createdBy, lines } = body.data;
  const [created] = await prisma.$transaction([
    prisma.printOut.create({ data: { title, createdBy, lines: lines as Prisma.InputJsonValue } }),
    // Old ones go, so the table never grows past a month of printing.
    prisma.printOut.deleteMany({ where: { createdAt: { lt: cutoff() } } }),
  ]);
  return NextResponse.json({ id: created.id }, { status: 201 });
}

// Recent print-outs, newest first, to pick the one in your hand.
export async function GET() {
  const rows = await prisma.printOut.findMany({
    where: { createdAt: { gte: cutoff() } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const printOuts: PrintOutSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    count: (r.lines as PrintLine[]).length,
  }));
  return NextResponse.json({ printOuts });
}
