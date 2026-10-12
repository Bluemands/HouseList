import { prisma } from "@/lib/prisma";
import type { PrintLine, PrintOutDTO } from "@/lib/printouts";

/** One print-out with its lines, or null if it's gone. */
export async function getPrintOut(id: string): Promise<PrintOutDTO | null> {
  const row = await prisma.printOut.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    lines: row.lines as PrintLine[],
  };
}
