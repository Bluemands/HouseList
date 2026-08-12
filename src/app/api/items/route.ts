import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemCreateSchema } from "@/lib/validation";
import { PRIORITIES, PRIORITY_ORDER, ROOMS, STATUSES } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

function parseEnumList<T extends string>(
  values: string[],
  allowed: readonly T[],
): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const priorities = parseEnumList(searchParams.getAll("priority"), PRIORITIES);
  const rooms = parseEnumList(searchParams.getAll("room"), ROOMS);
  const statuses = parseEnumList(searchParams.getAll("status"), STATUSES);
  const sort = searchParams.get("sort") ?? "priority";

  const where: Prisma.ItemWhereInput = {};
  if (priorities.length) where.priority = { in: priorities };
  if (rooms.length) where.room = { in: rooms };
  if (statuses.length) where.status = { in: statuses };

  let orderBy: Prisma.ItemOrderByWithRelationInput | Prisma.ItemOrderByWithRelationInput[];
  switch (sort) {
    case "price-desc":
      orderBy = { estimatedPrice: "desc" };
      break;
    case "price-asc":
      orderBy = { estimatedPrice: "asc" };
      break;
    case "recent":
      orderBy = { createdAt: "desc" };
      break;
    case "priority":
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  const items = await prisma.item.findMany({ where, orderBy });

  if (sort === "priority" || !sort) {
    items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = itemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const item = await prisma.item.create({
    data: {
      title: parsed.data.title,
      room: parsed.data.room,
      estimatedPrice: parsed.data.estimatedPrice,
      priority: parsed.data.priority,
      link: parsed.data.link ?? null,
      notes: parsed.data.notes ?? null,
      addedBy: parsed.data.addedBy,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
