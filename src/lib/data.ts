import { prisma } from "@/lib/prisma";
import type { ItemDTO } from "@/lib/types";

export async function getInitialData(): Promise<{ items: ItemDTO[]; budgetAvailable: number }> {
  // Sequential, not Promise.all: concurrent queries over the same adapter
  // pool have triggered "prepared statement" protocol errors against the
  // local Prisma Postgres dev server.
  const items = await prisma.item.findMany({ orderBy: { createdAt: "desc" } });
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, budgetAvailable: 0 },
  });

  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    budgetAvailable: settings.budgetAvailable,
  };
}
