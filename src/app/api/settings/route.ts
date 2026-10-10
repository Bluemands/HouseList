import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settingsUpdateSchema } from "@/lib/validation";
import { fromDay, getSettings, toSettingsDTO } from "@/lib/data";

export async function GET() {
  return NextResponse.json({ settings: toSettingsDTO(await getSettings()) });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { addMember, removeMember, movedInOn, lastPaydayOn, addToPot, ...rest } = parsed.data;
  const current = await getSettings();
  let members = current.members;
  if (addMember && !members.some((m) => m.toLowerCase() === addMember.toLowerCase())) {
    members = [...members, addMember];
  }
  if (removeMember) members = members.filter((m) => m !== removeMember);

  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: {
      ...rest,
      members,
      // Setting the pot or a saving is what starts it being kept.
      ...(rest.budgetAvailable !== undefined || addToPot !== undefined || (rest.monthlySaving ?? 0) > 0
        ? { potTracked: true }
        : {}),
      movedInOn: fromDay(movedInOn),
      lastPaydayOn: fromDay(lastPaydayOn),
      ...(addToPot !== undefined && rest.budgetAvailable === undefined
        ? { budgetAvailable: { increment: addToPot } }
        : {}),
    },
  });

  return NextResponse.json({ settings: toSettingsDTO(settings) });
}
